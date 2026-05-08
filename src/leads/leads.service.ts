import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lead, LeadDocument } from './schemas/lead.schema';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { BulkDeleteDto } from './dto/bulk-delete.dto';
import { UpdateStageDto, UpdateChecklistDto, AddNoteDto, BulkStageDto, BulkStatusDto, BulkScheduleDto } from './dto/workflow.dto';
import { parseUploadedFile } from './utils/file-parser';
import { normalizeRow } from './utils/column-mapper';

const ALLOWED_MIMETYPES = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_SORT_FIELDS = new Set([
  'createdAt', 'updatedAt', 'property_address', 'city', 'state',
  'est_value', 'last_sale_date', 'years_owned', 'equity_pct', 'workflow_stage',
]);

const WORKFLOW_STAGES = [
  'Imported', 'Cleaning', 'Cleaned', 'Email Enrichment',
  'Forewarn Verification', 'Ready for Outreach', 'Outreach Started',
  'Follow-up 1 Sent', 'Follow-up 2 Sent', 'Follow-up 3 Sent',
  'Follow-up 4 Sent', 'Follow-up 5 Sent', 'Follow-up 6 Sent',
  'Completed', 'Removed',
];

@Injectable()
export class LeadsService {
  constructor(@InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>) {}

  async findMany(dto: QueryLeadsDto) {
    const {
      page = 1,
      pageSize = 20,
      search,
      propertyType,
      state,
      outreachStatus,
      licenseVerificationStatus,
      sortBy = 'createdAt',
      sortDir = 'DESC',
    } = dto;

    const filter: Record<string, unknown> = {};

    if (search) filter['$text'] = { $search: search };
    if (propertyType) filter['property_type'] = propertyType;
    if (state) filter['state'] = state;
    if (outreachStatus) filter['outreach_status'] = outreachStatus;
    if (licenseVerificationStatus) filter['licenseVerificationStatus'] = licenseVerificationStatus;

    const anyDto = dto as Record<string, unknown>;
    if (anyDto['workflowStage']) filter['workflow_stage'] = anyDto['workflowStage'];
    if (anyDto['emailStatus']) filter['email_status'] = anyDto['emailStatus'];
    if (anyDto['phoneStatus']) filter['phone_status'] = anyDto['phoneStatus'];
    if (anyDto['foreWarnStatus']) filter['forewarn_status'] = anyDto['foreWarnStatus'];

    const safeSort = ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : 'createdAt';
    const sortOrder = sortDir === 'ASC' ? 1 : -1;

    const [data, total] = await Promise.all([
      this.leadModel
        .find(filter)
        .sort({ [safeSort]: sortOrder })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean()
        .exec(),
      this.leadModel.countDocuments(filter).exec(),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async importFile(file: Express.Multer.File) {
    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Allowed: CSV, XLSX`,
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File exceeds the 10 MB size limit');
    }

    const rawRows = parseUploadedFile(file.buffer);
    let imported = 0;
    let skipped = 0;
    const errors: Array<{ row: number; reason: string }> = [];

    for (let i = 0; i < rawRows.length; i++) {
      const rowNumber = i + 2;
      try {
        const normalized = normalizeRow(rawRows[i]);
        if (!normalized.property_id) {
          errors.push({ row: rowNumber, reason: 'Could not determine property_id' });
          skipped++;
          continue;
        }
        await this.leadModel.findOneAndUpdate(
          { property_id: normalized.property_id },
          { $set: { ...normalized, workflow_stage: normalized['workflow_stage'] || 'Imported' } },
          { upsert: true, new: true },
        );
        imported++;
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : String(err);
        errors.push({ row: rowNumber, reason });
        skipped++;
      }
    }

    return { imported, skipped, errors };
  }

  async bulkDelete(dto: BulkDeleteDto) {
    const result = await this.leadModel.deleteMany({ property_id: { $in: dto.ids } });
    return { deleted: result.deletedCount };
  }

  async getStats() {
    const [total, llcOwned, withPhone, withEmail, equityAgg, byTypeAgg, byStateAgg] =
      await Promise.all([
        this.leadModel.countDocuments(),
        this.leadModel.countDocuments({ owner_type: /llc/i }),
        this.leadModel.countDocuments({ phone: { $exists: true, $ne: '' } }),
        this.leadModel.countDocuments({ email: { $exists: true, $ne: '' } }),
        this.leadModel.aggregate<{ avg: number }>([
          { $match: { equity_pct: { $exists: true, $ne: null } } },
          { $group: { _id: null, avg: { $avg: '$equity_pct' } } },
        ]),
        this.leadModel.aggregate<{ _id: string; count: number }>([
          { $match: { property_type: { $exists: true, $nin: [null, ''] } } },
          { $group: { _id: '$property_type', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        this.leadModel.aggregate<{ _id: string; count: number }>([
          { $match: { state: { $exists: true, $nin: [null, ''] } } },
          { $group: { _id: '$state', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
      ]);

    return {
      total,
      llcOwned,
      withPhone,
      withEmail,
      avgEquity: equityAgg[0]?.avg ?? 0,
      byPropertyType: Object.fromEntries(byTypeAgg.map((r) => [r._id, r.count])),
      byState: Object.fromEntries(byStateAgg.map((r) => [r._id, r.count])),
    };
  }

  async getFilterOptions() {
    const [propertyTypes, states] = await Promise.all([
      this.leadModel.distinct('property_type', { property_type: { $nin: [null, ''] } }),
      this.leadModel.distinct('state', { state: { $nin: [null, ''] } }),
    ]);
    return {
      propertyTypes: (propertyTypes as string[]).sort(),
      states: (states as string[]).sort(),
    };
  }

  async getPipelineSummary() {
    const agg = await this.leadModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$workflow_stage', count: { $sum: 1 } } },
    ]);
    const map = Object.fromEntries(agg.map((r) => [r._id, r.count]));
    return WORKFLOW_STAGES.map((stage) => ({ stage, count: map[stage] ?? 0 }));
  }

  async advanceStage(propertyId: string, dto: UpdateStageDto) {
    const lead = await this.leadModel.findOneAndUpdate(
      { property_id: propertyId },
      { $set: { workflow_stage: dto.stage } },
      { new: true },
    );
    if (!lead) throw new NotFoundException(`Lead not found: ${propertyId}`);
    return lead;
  }

  async updateChecklist(propertyId: string, dto: UpdateChecklistDto) {
    const update: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dto)) {
      if (v !== undefined) update[`verification_checklist.${k}`] = v;
    }
    const lead = await this.leadModel.findOneAndUpdate(
      { property_id: propertyId },
      { $set: update },
      { new: true },
    );
    if (!lead) throw new NotFoundException(`Lead not found: ${propertyId}`);
    return lead;
  }

  async addNote(propertyId: string, dto: AddNoteDto) {
    const entry = { text: dto.text, createdAt: new Date().toISOString() };
    const lead = await this.leadModel.findOneAndUpdate(
      { property_id: propertyId },
      { $push: { notes: entry } },
      { new: true },
    );
    if (!lead) throw new NotFoundException(`Lead not found: ${propertyId}`);
    return lead;
  }

  async bulkUpdateStage(dto: BulkStageDto) {
    const result = await this.leadModel.updateMany(
      { property_id: { $in: dto.ids } },
      { $set: { workflow_stage: dto.stage } },
    );
    return { updated: result.modifiedCount };
  }

  async bulkUpdateStatus(dto: BulkStatusDto) {
    const update: Record<string, unknown> = {};
    if (dto.email_status) update['email_status'] = dto.email_status;
    if (dto.phone_status) update['phone_status'] = dto.phone_status;
    if (dto.forewarn_status) update['forewarn_status'] = dto.forewarn_status;
    const result = await this.leadModel.updateMany(
      { property_id: { $in: dto.ids } },
      { $set: update },
    );
    return { updated: result.modifiedCount };
  }

  async bulkScheduleFollowups(dto: BulkScheduleDto) {
    const result = await this.leadModel.updateMany(
      { property_id: { $in: dto.ids } },
      { $set: { next_followup: dto.next_followup } },
    );
    return { updated: result.modifiedCount };
  }

  async seedMockData() {
    const existing = await this.leadModel.countDocuments();
    if (existing > 0) {
      return { seeded: 0, message: 'Database already contains leads. Clear first to re-seed.' };
    }

    const mockLeads = [
      {
        property_id: 'SEED-001', property_address: '1420 W Market St', city: 'Indianapolis', state: 'IN',
        zip_code: '46222', property_type: 'Office', building_size_sqft: 12400, year_built: 1988,
        lot_size_acres: 0.8, owner_entity: 'Meridian Holdings LLC', owner_type: 'LLC',
        owner_first_name: 'James', owner_last_name: 'Caldwell', phone: '3175550101',
        email: 'jcaldwell@meridianhold.com', est_value: 1850000, equity_pct: 68,
        years_owned: 12, workflow_stage: 'Ready for Outreach', email_status: 'Valid',
        phone_status: 'Valid', forewarn_status: 'Cleared', licenseVerificationStatus: 'Verified',
        licenseNumber: 'IN-RE-00412', licenseStatus: 'Active', licenseSource: 'Indiana MyLicense eVerification',
      },
      {
        property_id: 'SEED-002', property_address: '3301 N Meridian St', city: 'Indianapolis', state: 'IN',
        zip_code: '46208', property_type: 'Retail', building_size_sqft: 5600, year_built: 2001,
        lot_size_acres: 0.4, owner_entity: 'Northside Properties LLC', owner_type: 'LLC',
        owner_first_name: 'Patricia', owner_last_name: 'Monroe', phone: '3175550202',
        email: '', est_value: 920000, equity_pct: 45, years_owned: 8,
        workflow_stage: 'Email Enrichment', email_status: 'Unknown', phone_status: 'Valid',
        forewarn_status: 'Pending', licenseVerificationStatus: 'Not Verified',
      },
      {
        property_id: 'SEED-003', property_address: '875 Massachusetts Ave', city: 'Indianapolis', state: 'IN',
        zip_code: '46204', property_type: 'Mixed Use', building_size_sqft: 18200, year_built: 1962,
        lot_size_acres: 1.1, owner_entity: 'Mass Ave Partners', owner_type: 'Partnership',
        owner_first_name: 'Robert', owner_last_name: 'Finley', phone: '3175550303',
        email: 'rob@massavepartners.com', est_value: 3100000, equity_pct: 82,
        years_owned: 22, workflow_stage: 'Outreach Started', email_status: 'Valid',
        phone_status: 'Valid', forewarn_status: 'Cleared', licenseVerificationStatus: 'Verified',
        licenseNumber: 'IN-RE-00891', licenseStatus: 'Active',
        last_contacted: new Date(Date.now() - 7 * 86400000).toISOString(),
        next_followup: new Date(Date.now() + 3 * 86400000).toISOString(),
      },
      {
        property_id: 'SEED-004', property_address: '2200 N Illinois St', city: 'Indianapolis', state: 'IN',
        zip_code: '46202', property_type: 'Industrial', building_size_sqft: 34500, year_built: 1975,
        lot_size_acres: 2.3, owner_entity: 'Keystone Industrial LLC', owner_type: 'LLC',
        owner_first_name: 'Sandra', owner_last_name: 'Holt', phone: '3175550404',
        email: 'sholt@keystoneind.com', est_value: 2750000, equity_pct: 59,
        years_owned: 15, workflow_stage: 'Forewarn Verification', email_status: 'Valid',
        phone_status: 'Valid', forewarn_status: 'Manual Review', licenseVerificationStatus: 'Not Verified',
      },
      {
        property_id: 'SEED-005', property_address: '550 Congressional Blvd', city: 'Carmel', state: 'IN',
        zip_code: '46032', property_type: 'Office', building_size_sqft: 8900, year_built: 2005,
        lot_size_acres: 0.6, owner_entity: 'Congressional Partners LLC', owner_type: 'LLC',
        owner_first_name: 'Michael', owner_last_name: 'Torres', phone: '3175550505',
        email: 'mtorres@congresspart.com', est_value: 1620000, equity_pct: 71,
        years_owned: 9, workflow_stage: 'Follow-up 1 Sent', email_status: 'Valid',
        phone_status: 'Valid', forewarn_status: 'Cleared', licenseVerificationStatus: 'Verified',
        licenseNumber: 'IN-RE-01203', licenseStatus: 'Active',
        last_contacted: new Date(Date.now() - 14 * 86400000).toISOString(),
        next_followup: new Date(Date.now() + 1 * 86400000).toISOString(),
      },
      {
        property_id: 'SEED-006', property_address: '4800 E 96th St', city: 'Indianapolis', state: 'IN',
        zip_code: '46240', property_type: 'Retail', building_size_sqft: 7200, year_built: 1993,
        lot_size_acres: 0.5, owner_entity: '96th Street Holdings', owner_type: 'Individual',
        owner_first_name: 'Linda', owner_last_name: 'Grayson', phone: '3175550606',
        email: 'lgrayson@email.com', est_value: 980000, equity_pct: 38,
        years_owned: 5, workflow_stage: 'Cleaning', email_status: 'Unknown',
        phone_status: 'Unknown', forewarn_status: 'Pending', licenseVerificationStatus: 'Not Verified',
      },
      {
        property_id: 'SEED-007', property_address: '1100 W 38th St', city: 'Indianapolis', state: 'IN',
        zip_code: '46208', property_type: 'Industrial', building_size_sqft: 22000, year_built: 1968,
        lot_size_acres: 1.8, owner_entity: 'Midtown Industrial Trust', owner_type: 'Trust',
        owner_first_name: 'Gerald', owner_last_name: 'Watts', phone: '',
        email: 'gwatts@midtowntrust.com', est_value: 1890000, equity_pct: 91,
        years_owned: 31, workflow_stage: 'Imported', email_status: 'Unknown',
        phone_status: 'Unknown', forewarn_status: 'Pending', licenseVerificationStatus: 'Not Verified',
      },
      {
        property_id: 'SEED-008', property_address: '220 N Senate Ave', city: 'Indianapolis', state: 'IN',
        zip_code: '46204', property_type: 'Office', building_size_sqft: 15600, year_built: 2010,
        lot_size_acres: 0.9, owner_entity: 'Senate Capital LLC', owner_type: 'LLC',
        owner_first_name: 'Angela', owner_last_name: 'Simmons', phone: '3175550808',
        email: 'asimmons@senatecap.com', est_value: 4200000, equity_pct: 55,
        years_owned: 7, workflow_stage: 'Completed', email_status: 'Valid',
        phone_status: 'Valid', forewarn_status: 'Cleared', licenseVerificationStatus: 'Verified',
        licenseNumber: 'IN-RE-00655', licenseStatus: 'Active',
      },
      {
        property_id: 'SEED-009', property_address: '6700 E 82nd St', city: 'Indianapolis', state: 'IN',
        zip_code: '46250', property_type: 'Mixed Use', building_size_sqft: 9800, year_built: 1999,
        lot_size_acres: 0.7, owner_entity: 'East 82 Ventures LLC', owner_type: 'LLC',
        owner_first_name: 'Thomas', owner_last_name: 'Nkosi', phone: '3175550909',
        email: 'tnkosi@east82.com', est_value: 1340000, equity_pct: 62,
        years_owned: 11, workflow_stage: 'Cleaned', email_status: 'Valid',
        phone_status: 'Valid', forewarn_status: 'Pending', licenseVerificationStatus: 'Not Verified',
      },
      {
        property_id: 'SEED-010', property_address: '3000 Shadeland Ave', city: 'Indianapolis', state: 'IN',
        zip_code: '46226', property_type: 'Industrial', building_size_sqft: 41000, year_built: 1958,
        lot_size_acres: 3.1, owner_entity: 'Shadeland Partners LLC', owner_type: 'LLC',
        owner_first_name: 'Carol', owner_last_name: 'Bergman', phone: '3175551010',
        email: 'cbergman@shadelandp.com', est_value: 3800000, equity_pct: 77,
        years_owned: 18, workflow_stage: 'Follow-up 2 Sent', email_status: 'Valid',
        phone_status: 'DNC', forewarn_status: 'Cleared', licenseVerificationStatus: 'Expired',
        licenseNumber: 'IN-RE-00234', licenseStatus: 'Expired', licenseExpirationDate: '2023-06-30',
        last_contacted: new Date(Date.now() - 21 * 86400000).toISOString(),
        next_followup: new Date(Date.now() + 7 * 86400000).toISOString(),
      },
      {
        property_id: 'SEED-011', property_address: '1550 N Keystone Ave', city: 'Indianapolis', state: 'IN',
        zip_code: '46201', property_type: 'Retail', building_size_sqft: 4200, year_built: 1985,
        lot_size_acres: 0.3, owner_entity: 'Keystone Retail LLC', owner_type: 'LLC',
        owner_first_name: 'Steven', owner_last_name: 'Okafor', phone: '3175551111',
        email: 'sokafor@keystoneretail.com', est_value: 560000, equity_pct: 44,
        years_owned: 6, workflow_stage: 'Removed', email_status: 'Bounced',
        phone_status: 'Invalid', forewarn_status: 'Flagged', licenseVerificationStatus: 'Not Verified',
      },
      {
        property_id: 'SEED-012', property_address: '750 E Washington St', city: 'Indianapolis', state: 'IN',
        zip_code: '46202', property_type: 'Office', building_size_sqft: 11300, year_built: 2015,
        lot_size_acres: 0.7, owner_entity: 'Washington Street Ventures LLC', owner_type: 'LLC',
        owner_first_name: 'Nicole', owner_last_name: 'Ferreira', phone: '3175551212',
        email: 'nferreira@wsventures.com', est_value: 2100000, equity_pct: 66,
        years_owned: 4, workflow_stage: 'Ready for Outreach', email_status: 'Valid',
        phone_status: 'Valid', forewarn_status: 'Cleared', licenseVerificationStatus: 'Not Verified',
      },
    ];

    await this.leadModel.insertMany(mockLeads);
    return { seeded: mockLeads.length, message: `Seeded ${mockLeads.length} mock leads.` };
  }
}
