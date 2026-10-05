const { Booking, Provider } = require('../models');
const { Op } = require('sequelize');

/**
 * Time-slot overlap check.
 * A booking occupies [start, start + duration). Two bookings conflict if their
 * intervals overlap. Statuses that 'hold' a slot: pending, accepted, on_the_way,
 * arrived, in-progress. This prevents double-booking of the same provider in overlapping times.
 */
const ACTIVE_STATUSES = ['pending', 'accepted', 'on_the_way', 'arrived', 'in-progress'];

const normalizeDate = (value) => {
  const d = new Date(value);
  return d;
};

const isOverlapping = (startA, durAMin, startB, durBMin) => {
  const aStart = normalizeDate(startA).getTime();
  const aEnd = aStart + durAMin * 60 * 1000;
  const bStart = normalizeDate(startB).getTime();
  const bEnd = bStart + durBMin * 60 * 1000;
  return aStart < bEnd && bStart < aEnd;
};

/**
 * Check whether the given provider/service is free at the requested time.
 * providerId: Provider.id (UUID string)
 * serviceId: Service.id (UUID string)
 * bookingTime: Date or ISO string
 * serviceDurationMin: duration of the service in minutes
 * excludeBookingId: optional booking id to ignore (for edit use)
 */
exports.checkAvailability = async ({
  providerId,
  serviceId,
  bookingTime,
  serviceDurationMin,
  excludeBookingId,
}) => {
  const order = 'ASC'; // no-op placeholder kept for clarity

  const conflicts = await Booking.findAll({
    where: {
      provider_id: providerId,
      status: { [Op.in]: ACTIVE_STATUSES },
      ...(excludeBookingId ? { id: { [Op.ne]: excludeBookingId } } : {}),
    },
    attributes: ['id', 'booking_time', 'service_id', 'status'],
    include: [{ as: 'service', model: require('../models').Service, attributes: ['id', 'duration'] }],
  });

  const clash = conflicts.find((b) => {
    const otherDuration = b.service ? b.service.duration : serviceDurationMin;
    return isOverlapping(bookingTime, serviceDurationMin, b.booking_time, otherDuration);
  });

  return {
    available: !clash,
    conflict: clash ? clash.id : null,
  };
};

/**
 * Generate available time slots for a provider on a given date,
 * based on their working_hours JSON and existing bookings.
 * working_hours example:
 *   { "monday": [{ "start": "08:00", "end": "17:00" }], "tuesday": [...], ... }
 * Days are 0-indexed in JS Date (0=Sunday). Provider stores names (lowercase).
 */
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const toHHMM = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

exports.generateSlots = async ({ providerId, date, slotMinutes = 30, durationMin }) => {
  const targetDay = DAY_NAMES[normalizeDate(date).getDay()];

  const provider = await Provider.findByPk(providerId);
  if (!provider || !provider.working_hours) {
    return { slots: [], message: 'Provider has no working hours configured.' };
  }

  const dayRanges = provider.working_hours[targetDay];
  if (!dayRanges || dayRanges.length === 0) {
    return { slots: [], message: `Provider is not available on ${targetDay}.` };
  }

  const startOfDay = new Date(normalizeDate(date));
  startOfDay.setHours(0, 0, 0, 0);

  const activeBookings = await Booking.findAll({
    where: {
      provider_id: providerId,
      status: { [Op.in]: ACTIVE_STATUSES },
    },
    attributes: ['booking_time', 'service_id', 'status'],
    include: [{ as: 'service', model: require('../models').Service, attributes: ['duration'] }],
  });

  const slots = [];
  for (const range of dayRanges) {
    let t = toMinutes(range.start);
    const end = toMinutes(range.end);
    while (t + (durationMin || slotMinutes) <= end) {
      const slotTime = new Date(startOfDay.getTime() + t * 60 * 1000);

      const clash = activeBookings.some((b) => {
        const bDur = b.service ? b.service.duration : durationMin || slotMinutes;
        return isOverlapping(slotTime, durationMin || slotMinutes, b.booking_time, bDur);
      });

      if (!clash) {
        slots.push({
          time: slotTime.toISOString(),
          label: toHHMM(t),
        });
      }
      t += slotMinutes;
    }
  }

  return { slots };
};
