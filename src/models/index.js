const User = require('./User');
const Provider = require('./Provider');
const Service = require('./Service');
const Booking = require('./Booking');
const Payment = require('./Payment');
const Review = require('./Review');
const Notification = require('./Notification');
const Location = require('./Location');
const Category = require('./Category');
const Certification = require('./Certification');
const Crew = require('./Crew');
const CrewMember = require('./CrewMember');
const Dispute = require('./Dispute');
const Endorsement = require('./Endorsement');
const Conversation = require('./Conversation');
const Message = require('./Message');
const Favourite = require('./Favourite');
const Address = require('./Address');
const PortfolioItem = require('./PortfolioItem');

User.hasOne(Provider, { foreignKey: 'user_id', as: 'providerProfile' });
Provider.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Certification associations
Provider.hasMany(Certification, { foreignKey: 'provider_id', as: 'certifications' });
Certification.belongsTo(Provider, { foreignKey: 'provider_id', as: 'provider' });

// Crew associations
Provider.hasMany(Crew, { foreignKey: 'leader_id', as: 'crewsLed' });
Crew.belongsTo(Provider, { foreignKey: 'leader_id', as: 'leader' });
Crew.belongsToMany(Provider, { through: CrewMember, foreignKey: 'crew_id', as: 'members' });
Provider.belongsToMany(Crew, { through: CrewMember, foreignKey: 'provider_id', as: 'crews' });

// Dispute associations
Booking.hasMany(Dispute, { foreignKey: 'booking_id', as: 'disputes' });
Dispute.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
Dispute.belongsTo(Provider, { foreignKey: 'provider_id', as: 'provider' });
Dispute.belongsTo(User, { foreignKey: 'reporter_id', as: 'reporter' });

// Crew booking association
Booking.belongsTo(Crew, { foreignKey: 'crew_id', as: 'crew' });
Crew.hasMany(Booking, { foreignKey: 'crew_id', as: 'bookings' });

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

// Peer verification: a different worker vouches for a completed job.
Booking.hasOne(Endorsement, { foreignKey: 'booking_id', as: 'endorsement' });
Endorsement.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
Provider.hasMany(Endorsement, { foreignKey: 'requester_id', as: 'endorsementsRequested' });
Provider.hasMany(Endorsement, { foreignKey: 'peer_id', as: 'endorsementsToVerify' });
Endorsement.belongsTo(Provider, { foreignKey: 'requester_id', as: 'requester' });
Endorsement.belongsTo(Provider, { foreignKey: 'peer_id', as: 'peer' });

Booking.hasOne(Review, { foreignKey: 'booking_id', as: 'review' });
Review.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
Review.belongsTo(User, { foreignKey: 'customer_id', as: 'customer' });
Review.belongsTo(Provider, { foreignKey: 'provider_id', as: 'provider' });

User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Provider.hasMany(Location, { foreignKey: 'provider_id', as: 'locations' });
Location.belongsTo(Provider, { foreignKey: 'provider_id', as: 'provider' });

// Message associations: one conversation per booking between customer + provider.
Booking.hasOne(Conversation, { foreignKey: 'booking_id', as: 'conversation' });
Conversation.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
Conversation.belongsTo(User, { foreignKey: 'customer_id', as: 'customer' });
Conversation.belongsTo(Provider, { foreignKey: 'provider_id', as: 'provider' });
Conversation.hasMany(Message, { foreignKey: 'conversation_id', as: 'messages' });
Message.belongsTo(Conversation, { foreignKey: 'conversation_id', as: 'conversation' });
Message.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });

// Favourites: a customer saves providers for quick re-booking.
User.hasMany(Favourite, { foreignKey: 'user_id', as: 'favourites' });
Favourite.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Provider.hasMany(Favourite, { foreignKey: 'provider_id', as: 'favouritedBy' });
Favourite.belongsTo(Provider, { foreignKey: 'provider_id', as: 'provider' });

// Saved addresses: a user keeps reusable home/office locations for booking.
User.hasMany(Address, { foreignKey: 'user_id', as: 'addresses' });
Address.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Portfolio: a provider showcases images of past work.
Provider.hasMany(PortfolioItem, { foreignKey: 'provider_id', as: 'portfolio' });
PortfolioItem.belongsTo(Provider, { foreignKey: 'provider_id', as: 'provider' });

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
  Certification,
  Crew,
  CrewMember,
  Dispute,
  Endorsement,
  Conversation,
  Message,
  Favourite,
  Address,
  PortfolioItem,
};
