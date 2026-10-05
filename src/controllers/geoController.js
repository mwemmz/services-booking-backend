const { Op } = require('sequelize');
const { Booking, Provider } = require('../models');

const ACTIVE_JOB_STATUSES = ['pending', 'accepted', 'on_the_way', 'arrived', 'in-progress'];

/** ~1 km grid cell: 0.01 degrees of latitude/longitude. */
const GRID_PRECISION = 2;

function cellKey(lat, lng) {
  return `${Number(lat).toFixed(GRID_PRECISION)},${Number(lng).toFixed(GRID_PRECISION)}`;
}

/**
 * Demand vs supply per neighbourhood:
 * active jobs vs online workers, grouped into ~1 km cells.
 */
async function computeDemandMap() {
  const [jobs, workers] = await Promise.all([
    Booking.findAll({
      where: {
        status: { [Op.in]: ACTIVE_JOB_STATUSES },
        location_lat: { [Op.ne]: null },
        location_lng: { [Op.ne]: null },
      },
      attributes: ['location_lat', 'location_lng'],
      raw: true,
    }),
    Provider.findAll({
      where: {
        is_online: true,
        location_lat: { [Op.ne]: null },
        location_lng: { [Op.ne]: null },
      },
      attributes: ['location_lat', 'location_lng'],
      raw: true,
    }),
  ]);

  const cells = new Map();
  jobs.forEach((job) => {
    const key = cellKey(job.location_lat, job.location_lng);
    const cell = cells.get(key) || {
      lat: Number(Number(job.location_lat).toFixed(GRID_PRECISION)),
      lng: Number(Number(job.location_lng).toFixed(GRID_PRECISION)),
      activeJobs: 0,
      onlineWorkers: 0,
    };
    cell.activeJobs += 1;
    cells.set(key, cell);
  });
  workers.forEach((worker) => {
    const key = cellKey(worker.location_lat, worker.location_lng);
    const cell = cells.get(key) || {
      lat: Number(Number(worker.location_lat).toFixed(GRID_PRECISION)),
      lng: Number(Number(worker.location_lng).toFixed(GRID_PRECISION)),
      activeJobs: 0,
      onlineWorkers: 0,
    };
    cell.onlineWorkers += 1;
    cells.set(key, cell);
  });

  const cellList = Array.from(cells.values())
    .map((cell) => ({
      ...cell,
      gap: cell.activeJobs - cell.onlineWorkers,
      underserved: cell.activeJobs > cell.onlineWorkers,
    }))
    .sort((a, b) => b.gap - a.gap);

  return {
    cells: cellList,
    summary: {
      totalActiveJobs: jobs.length,
      totalOnlineWorkers: workers.length,
      underservedCells: cellList.filter((c) => c.underserved).length,
      coveredCells: cellList.filter((c) => !c.underserved).length,
    },
  };
}

exports.getDemandMap = async (req, res) => {
  try {
    return res.json(await computeDemandMap());
  } catch (error) {
    return res.status(500).json({ message: 'Failed to compute demand map.', error: error.message });
  }
};

/**
 * Provider-facing opportunities: the underserved cells where demand beats supply.
 */
exports.getOpportunities = async (req, res) => {
  try {
    const { cells, summary } = await computeDemandMap();
    const opportunities = cells
      .filter((cell) => cell.gap > 0)
      .slice(0, 20)
      .map((cell) => ({
        lat: cell.lat,
        lng: cell.lng,
        activeJobs: cell.activeJobs,
        onlineWorkers: cell.onlineWorkers,
        gap: cell.gap,
      }));

    return res.json({ opportunities, summary });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch opportunities.', error: error.message });
  }
};