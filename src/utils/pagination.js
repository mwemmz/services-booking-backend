const paginate = (query, { page = 1, limit = 20 } = {}) => {
  const offset = (page - 1) * limit;
  return {
    ...query,
    limit: parseInt(limit),
    offset: parseInt(offset),
  };
};

const buildPaginationResponse = (count, page, limit) => {
  const totalPages = Math.ceil(count / limit);
  return {
    total: count,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages,
    hasNext: parseInt(page) < totalPages,
    hasPrev: parseInt(page) > 1,
  };
};

module.exports = { paginate, buildPaginationResponse };
