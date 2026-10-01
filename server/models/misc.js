import mongoose from 'mongoose';
const { Schema } = mongoose;
const ref = (m, extra = {}) => ({ type: Schema.Types.ObjectId, ref: m, ...extra });

const tripMemberSchema = new Schema({
  trip: ref('Trip', { required: true }), user: ref('User', { required: true }),
  role: { type: String, enum: ['owner','member'], default: 'member' }, joinedAt: { type: Date, default: Date.now }
}, { timestamps: true });
tripMemberSchema.index({ trip: 1, user: 1 }, { unique: true });
tripMemberSchema.index({ user: 1 });
export const TripMember = mongoose.model('TripMember', tripMemberSchema);

const joinRequestSchema = new Schema({
  trip: ref('Trip', { required: true }), user: ref('User', { required: true }),
  message: { type: String, maxlength: 500, default: '' },
  status: { type: String, enum: ['pending','accepted','rejected'], default: 'pending' }
}, { timestamps: true });
joinRequestSchema.index({ trip: 1, user: 1 }, { unique: true });
export const JoinRequest = mongoose.model('JoinRequest', joinRequestSchema);

const invitationSchema = new Schema({
  trip: ref('Trip', { required: true }), from: ref('User', { required: true }), to: ref('User', { required: true }),
  status: { type: String, enum: ['pending','accepted','declined'], default: 'pending' }
}, { timestamps: true });
invitationSchema.index({ trip: 1, to: 1 }, { unique: true });
export const Invitation = mongoose.model('Invitation', invitationSchema);

const conversationSchema = new Schema({
  participants: [ref('User')],
  type: { type: String, enum: ['private','group'], required: true },
  trip: ref('Trip'),
  pairKey: { type: String, unique: true, sparse: true },
  lastMessage: ref('Message'),
  lastMessageAt: { type: Date, default: Date.now }
}, { timestamps: true });
conversationSchema.index({ participants: 1, lastMessageAt: -1 });
export const Conversation = mongoose.model('Conversation', conversationSchema);

const messageSchema = new Schema({
  conversation: ref('Conversation', { required: true, index: true }),
  sender: ref('User', { required: true }),
  type: { type: String, enum: ['text','image','file','voice','system','invite'], default: 'text' },
  text: { type: String, maxlength: 4000, default: '' },
  mediaUrl: String, fileName: String, mimeType: String,
  duration: Number, waveform: [Number],
  replyTo: ref('Message'),
  invitation: ref('Invitation'),
  reactions: [{ user: ref('User'), emoji: String, _id: false }],
  readBy: [ref('User')],
  deliveredTo: [ref('User')],
  pinned: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false },
  deletedFor: [ref('User')]
}, { timestamps: true });
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ text: 'text' });
export const Message = mongoose.model('Message', messageSchema);

const notificationSchema = new Schema({
  user: ref('User', { required: true }), actor: ref('User'),
  type: { type: String, required: true },
  title: String, body: String, link: String,
  read: { type: Boolean, default: false }
}, { timestamps: true });
notificationSchema.index({ user: 1, createdAt: -1 });
export const Notification = mongoose.model('Notification', notificationSchema);

const reviewSchema = new Schema({
  trip: ref('Trip', { required: true }), author: ref('User', { required: true }),
  rating: { type: Number, min: 1, max: 5, required: true }, comment: { type: String, maxlength: 1000, default: '' }
}, { timestamps: true });
reviewSchema.index({ trip: 1, author: 1 }, { unique: true });
export const Review = mongoose.model('Review', reviewSchema);

const connectionSchema = new Schema({
  requester: ref('User', { required: true }), recipient: ref('User', { required: true }),
  status: { type: String, enum: ['pending','accepted'], default: 'pending' }
}, { timestamps: true });
connectionSchema.index({ requester: 1, recipient: 1 }, { unique: true });
export const Connection = mongoose.model('Connection', connectionSchema);

const favoriteSchema = new Schema({ user: ref('User', { required: true }), trip: ref('Trip', { required: true }) }, { timestamps: true });
favoriteSchema.index({ user: 1, trip: 1 }, { unique: true });
export const Favorite = mongoose.model('Favorite', favoriteSchema);

const reportSchema = new Schema({
  reporter: ref('User', { required: true }),
  targetType: { type: String, enum: ['user','trip','message'], required: true },
  targetUser: ref('User'), targetTrip: ref('Trip'),
  category: { type: String, enum: ['Spam','Harassment','Fake profile','Scam','Inappropriate content','Other'], required: true },
  details: { type: String, maxlength: 1000, default: '' },
  status: { type: String, enum: ['open','resolved','dismissed'], default: 'open' },
  resolutionNote: String
}, { timestamps: true });
reportSchema.index({ status: 1, createdAt: -1 });
export const Report = mongoose.model('Report', reportSchema);

const expenseSchema = new Schema({
  trip: ref('Trip', { required: true, index: true }),
  description: { type: String, required: true, maxlength: 140 },
  amount: { type: Number, required: true, min: 0.01 },
  paidBy: ref('User', { required: true }),
  participants: [ref('User')],
  date: { type: Date, default: Date.now }
}, { timestamps: true });
export const Expense = mongoose.model('Expense', expenseSchema);

const callSchema = new Schema({
  caller: ref('User', { required: true }), receiver: ref('User', { required: true }),
  callType: { type: String, enum: ['voice','video'], default: 'voice' },
  status: { type: String, enum: ['calling','accepted','rejected','missed','completed','failed'], default: 'calling' },
  startedAt: Date, endedAt: Date, duration: { type: Number, default: 0 }
}, { timestamps: true });
callSchema.index({ caller: 1, createdAt: -1 });
callSchema.index({ receiver: 1, createdAt: -1 });
export const Call = mongoose.model('Call', callSchema);

const categorySchema = new Schema({ name: { type: String, required: true, unique: true, trim: true, maxlength: 40 }, active: { type: Boolean, default: true } }, { timestamps: true });
export const Category = mongoose.model('Category', categorySchema);

const tripPhotoSchema = new Schema({ trip: ref('Trip', { required: true, index: true }), user: ref('User', { required: true }), url: { type: String, required: true }, caption: { type: String, maxlength: 200, default: '' } }, { timestamps: true });
export const TripPhoto = mongoose.model('TripPhoto', tripPhotoSchema);

// Private to the author: hotel bookings, transport details, emergency contacts, notes. Never shown to other members.
const tripNoteSchema = new Schema({ trip: ref('Trip', { required: true }), user: ref('User', { required: true }), kind: { type: String, enum: ['hotel', 'transport', 'emergency', 'note'], default: 'note' }, title: { type: String, required: true, maxlength: 100 }, content: { type: String, maxlength: 2000, default: '' } }, { timestamps: true });
tripNoteSchema.index({ trip: 1, user: 1 });
export const TripNote = mongoose.model('TripNote', tripNoteSchema);
