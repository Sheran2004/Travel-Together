import mongoose from 'mongoose';
const { Schema } = mongoose;

export const TRAVEL_STYLES = ['Backpacker','Budget','Luxury','Adventure','Nature','Photography','Cultural','Food','Road trip','Trekking'];

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9_.]{3,24}$/ },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  profileImage: { type: String, default: '' },
  bio: { type: String, default: '', maxlength: 500 },
  age: { type: Number, min: 13, max: 120 },
  gender: { type: String, enum: ['male','female','non-binary','prefer-not-to-say',''], default: '' },
  city: { type: String, default: '', trim: true },
  country: { type: String, default: '', trim: true },
  languages: [String],
  travelInterests: [String],
  travelStyle: [{ type: String, enum: TRAVEL_STYLES }],
  budgetMin: { type: Number, default: 0 },
  budgetMax: { type: Number, default: 50000 },
  favoriteDestinations: [String],
  role: { type: String, enum: ['user','admin'], default: 'user' },
  suspended: { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: false },
  blocked: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  restricted: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  theme: { type: String, enum: ['light','dark','system'], default: 'system' },
  privacySettings: {
    whoCanMessage: { type: String, enum: ['everyone','connections','shared-trips','nobody'], default: 'everyone' },
    profileVisibility: { type: String, enum: ['public','members','private'], default: 'public' },
    showOnlineStatus: { type: Boolean, default: true },
    showLastSeen: { type: Boolean, default: true }
  },
  notificationSettings: {
    messages: { type: Boolean, default: true },
    calls: { type: Boolean, default: true },
    tripUpdates: { type: Boolean, default: true },
    invitations: { type: Boolean, default: true },
    marketing: { type: Boolean, default: false }
  },
  emergencyContact: { name: String, phone: String },
  lastSeen: { type: Date, default: Date.now },
  tokenVersion: { type: Number, default: 0 },
  resetTokenHash: { type: String, select: false },
  resetTokenExpires: { type: Date, select: false },
  pendingEmail: { type: String, lowercase: true, trim: true },
  emailChangeHash: { type: String, select: false },
  emailChangeExpires: { type: Date, select: false },
  verifyTokenHash: { type: String, select: false },
  verifyTokenExpires: { type: Date, select: false }
}, { timestamps: true });

userSchema.index({ name: 'text', username: 'text', city: 'text', travelInterests: 'text', bio: 'text' });
userSchema.index({ city: 1 });

userSchema.methods.toJSON = function () {
  const o = this.toObject();
  delete o.password; delete o.resetTokenHash; delete o.resetTokenExpires; delete o.emailChangeHash; delete o.emailChangeExpires; delete o.verifyTokenHash; delete o.verifyTokenExpires; delete o.tokenVersion; delete o.__v;
  return o;
};

export default mongoose.model('User', userSchema);
