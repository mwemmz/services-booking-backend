const User = require('./User');
const Provider = require('./Provider');
const Service = require('./Service');
const Booking = require('./Booking');
const Payment = require('./Payment');
const Review = require('./Review');
const Notification = require('./Notification');
const Location = require('./Location');
const Category = require('./Category');

User.hasOne(Provider, { foreignKey: 'user_id', as: 'providerProfile' });
Provider.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Provider.hasMany(Service, { foreignKey: 'provider_id', as: 'services' });
Service.belongsTo(Provider, { foreignKey: 'provider_id', as: 'provider' });

User.hasMany(Booking, { foreignKey: 'customer_id', as: 'customerBookings' });
Provider.hasMany(Booking, { foreignKey: 'provider_id', as: 'providerBookings' });
Service.hasMany(Booking, { foreignKey: 'service_id', as: 'bookings' });
Booking.belongsTo(User, { foreignKey: 'customer_id', as: 'customer' });
Booking.belongsTo(Provider, { foreignKey: 'provider_id', as: 'provider' });
Booking.belongsTo(Service, { foreignKey: 'service_id', as: 'service' });

Booking.hasOne(Payment, { foreignKey: 'booking_id', as: 'payment' });
Payment.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });

Booking.hasOne(Review, { foreignKey: 'booking_id', as: 'review' });
Review.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
Review.belongsTo(User, { foreignKey: 'customer_id', as: 'customer' });
Review.belongsTo(Provider, { foreignKey: 'provider_id', as: 'provider' });

User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Provider.hasMany(Location, { foreignKey: 'provider_id', as: 'locations' });
Location.belongsTo(Provider, { foreignKey: 'provider_id', as: 'provider' });

module.exports = {
  User,
  Provider,
  Service,
  Booking,
  Payment,
  Review,
  Notification,
  Location,
  Category,
};
