import mongoose from 'mongoose';
import { TRAVEL_STYLES } from './User.js';
const { Schema } = mongoose;

export const CATEGORIES = ['Beach','Mountains','Trekking','Adventure','Backpacking','Road Trip','Weekend','Cultural','Nature','International'];
export const TRANSPORT = ['flight','train','bus','car','bike','walking','none'];

const itinerarySchema = new Schema({
  day: { type: Number, required: true, min: 1 },
  date: Date,
  time: String,
  locationName: { type: String, required: true, trim: true },
  latitude: { type: Number, min: -90, max: 90 },
  longitude: { type: Number, min: -180, max: 180 },
  activity: { type: String, required: true, trim: true },
  description: String,
  transport: { type: String, enum: TRANSPORT, default: 'none' },
  departure: String,
  arrival: String,
  notes: String
}, { _id: true });

const checklistSchema = new Schema({
  text: { type: String, required: true, trim: true, maxlength: 120 },
  done: { type: Boolean, default: false },
  doneBy: { type: Schema.Types.ObjectId, ref: 'User' },
  addedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { _id: true });

const tripSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, unique: true, index: true },
  destination: { type: String, required: true, trim: true },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  country: { type: String, default: 'India' },
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  description: { type: String, required: true, maxlength: 4000 },
  coverImage: { type: String, default: '' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  budget: { type: Number, required: true, min: 0 },
  category: { type: String, required: true, trim: true }, // validated against the Category collection (admin-managed)
  travelStyle: { type: String, enum: TRAVEL_STYLES },
  difficulty: { type: String, enum: ['Easy','Moderate','Hard'], default: 'Easy' },
  ageMin: { type: Number, default: 18 },
  ageMax: { type: Number, default: 60 },
  maxMembers: { type: Number, required: true, min: 2, max: 100 },
  memberCount: { type: Number, default: 1 },
  creator: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  joinMode: { type: String, enum: ['open','request'], default: 'open' },
  visibility: { type: String, enum: ['public','private'], default: 'public' },
  meetingPoint: String,
  activities: [String],
  status: { type: String, enum: ['active','cancelled','completed'], default: 'active', index: true },
  itinerary: [itinerarySchema],
  checklist: [checklistSchema],
  conversation: { type: Schema.Types.ObjectId, ref: 'Conversation' },
  avgRating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  savedCount: { type: Number, default: 0 }
}, { timestamps: true });

tripSchema.index({ title: 'text', destination: 'text', description: 'text', activities: 'text', city: 'text', state: 'text' });
tripSchema.index({ startDate: 1 });
tripSchema.index({ budget: 1 });
tripSchema.index({ latitude: 1, longitude: 1 });
tripSchema.index({ category: 1, status: 1 });

tripSchema.virtual('durationDays').get(function () {
  return Math.max(1, Math.round((this.endDate - this.startDate) / 86400000) + 1);
});
tripSchema.set('toJSON', { virtuals: true });
tripSchema.set('toObject', { virtuals: true });

export default mongoose.model('Trip', tripSchema);
