const express = require('express');
const { query } = require('express-validator');
const { searchPlaces, reverseGeocode, getRoute } = require('../controllers/geoLookupController');
const validate = require('../middleware/validate');

const router = express.Router();

const latitudeRule = query('lat').optional().isFloat({ min: -90, max: 90 }).withMessage('lat must be a valid latitude');
const longitudeRule = query('lng').optional().isFloat({ min: -180, max: 180 }).withMessage('lng must be a valid longitude');

router.get(
  '/search',
  [query('q').trim().notEmpty().withMessage('A search term is required'), latitudeRule, longitudeRule, validate],
  searchPlaces,
);

router.get(
  '/reverse',
  [
    query('lat').isFloat({ min: -90, max: 90 }).withMessage('lat must be a valid latitude'),
    query('lng').isFloat({ min: -180, max: 180 }).withMessage('lng must be a valid longitude'),
    validate,
  ],
  reverseGeocode,
);

router.get(
  '/route',
  [
    query('from_lat').isFloat({ min: -90, max: 90 }).withMessage('from_lat must be a valid latitude'),
    query('from_lng').isFloat({ min: -180, max: 180 }).withMessage('from_lng must be a valid longitude'),
    query('to_lat').isFloat({ min: -90, max: 90 }).withMessage('to_lat must be a valid latitude'),
    query('to_lng').isFloat({ min: -180, max: 180 }).withMessage('to_lng must be a valid longitude'),
    validate,
  ],
  getRoute,
);

module.exports = router;