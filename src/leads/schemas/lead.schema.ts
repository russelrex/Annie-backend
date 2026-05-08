import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LeadDocument = Lead & Document;

@Schema({ _id: false })
class NoteEntry {
  @Prop({ required: true }) text: string;
  @Prop({ required: true }) createdAt: string;
}
const NoteEntrySchema = SchemaFactory.createForClass(NoteEntry);

@Schema({ _id: false })
class VerificationChecklist {
  @Prop({ default: false }) propertyConfirmed: boolean;
  @Prop({ default: false }) ownerIdentityVerified: boolean;
  @Prop({ default: false }) phoneVerified: boolean;
  @Prop({ default: false }) emailVerified: boolean;
  @Prop({ default: false }) foreWarnCleared: boolean;
  @Prop({ default: false }) licenseVerified: boolean;
  @Prop({ default: false }) doNotContactChecked: boolean;
  @Prop({ default: false }) outreachDrafted: boolean;
  @Prop({ default: false }) approvedForOutreach: boolean;
}
const VerificationChecklistSchema = SchemaFactory.createForClass(VerificationChecklist);

@Schema({ timestamps: true, collection: 'leads' })
export class Lead {
  @Prop({ required: true, unique: true, index: true })
  property_id: string;

  @Prop() property_address: string;
  @Prop({ index: true }) city: string;
  @Prop({ index: true }) state: string;
  @Prop() zip_code: string;
  @Prop({ index: true }) property_type: string;
  @Prop() building_size_sqft: number;
  @Prop() year_built: number;
  @Prop() lot_size_acres: number;
  @Prop({ index: true }) owner_entity: string;
  @Prop({ index: true }) owner_type: string;
  @Prop() owner_first_name: string;
  @Prop() owner_last_name: string;
  @Prop() mailing_address: string;
  @Prop() mailing_city: string;
  @Prop() mailing_state: string;
  @Prop() mailing_zip: string;
  @Prop() phone: string;
  @Prop() email: string;
  @Prop() est_value: number;
  @Prop() last_sale_price: number;
  @Prop() last_sale_date: string;
  @Prop() years_owned: number;
  @Prop() loan_amount: number;
  @Prop() loan_type: string;
  @Prop() loan_maturity_date: string;
  @Prop() equity_pct: number;
  @Prop() vacancy: string;
  @Prop() zoning: string;
  @Prop({ index: true }) outreach_status: string;

  // Workflow fields
  @Prop({
    default: 'Imported',
    enum: [
      'Imported', 'Cleaning', 'Cleaned', 'Email Enrichment',
      'Forewarn Verification', 'Ready for Outreach', 'Outreach Started',
      'Follow-up 1 Sent', 'Follow-up 2 Sent', 'Follow-up 3 Sent',
      'Follow-up 4 Sent', 'Follow-up 5 Sent', 'Follow-up 6 Sent',
      'Completed', 'Removed',
    ],
    index: true,
  })
  workflow_stage: string;

  @Prop({ default: 'Unknown', enum: ['Unknown', 'Valid', 'Invalid', 'Bounced'] })
  email_status: string;

  @Prop({ default: 'Unknown', enum: ['Unknown', 'Valid', 'Invalid', 'DNC'] })
  phone_status: string;

  @Prop({ default: 'Pending', enum: ['Pending', 'Cleared', 'Flagged', 'Manual Review'] })
  forewarn_status: string;

  @Prop() last_contacted: string;
  @Prop() next_followup: string;

  @Prop({ type: [NoteEntrySchema], default: [] })
  notes: NoteEntry[];

  @Prop({ type: VerificationChecklistSchema, default: () => ({}) })
  verification_checklist: VerificationChecklist;

  // License verification fields
  @Prop({ default: 'Not Verified', index: true }) licenseVerificationStatus: string;
  @Prop() licenseProfession: string;
  @Prop() licenseType: string;
  @Prop() licenseNumber: string;
  @Prop() licenseStatus: string;
  @Prop() licenseExpirationDate: string;
  @Prop() licenseVerifiedAt: string;
  @Prop({ default: 'Indiana MyLicense eVerification' }) licenseSource: string;
  @Prop() licenseNotes: string;
}

export const LeadSchema = SchemaFactory.createForClass(Lead);

LeadSchema.index({
  property_address: 'text',
  city: 'text',
  owner_entity: 'text',
  owner_first_name: 'text',
  owner_last_name: 'text',
  property_id: 'text',
});
