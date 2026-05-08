import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Body,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { LeadsService } from './leads.service';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { BulkDeleteDto } from './dto/bulk-delete.dto';
import { UpdateStageDto, UpdateChecklistDto, AddNoteDto, BulkStageDto, BulkStatusDto, BulkScheduleDto } from './dto/workflow.dto';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIMETYPES = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  /** GET /api/leads */
  @Get()
  findMany(@Query() query: QueryLeadsDto) {
    return this.leadsService.findMany(query);
  }

  /** GET /api/leads/stats */
  @Get('stats')
  getStats() {
    return this.leadsService.getStats();
  }

  /** GET /api/leads/filter-options */
  @Get('filter-options')
  getFilterOptions() {
    return this.leadsService.getFilterOptions();
  }

  /** GET /api/leads/pipeline-summary */
  @Get('pipeline-summary')
  getPipelineSummary() {
    return this.leadsService.getPipelineSummary();
  }

  /** POST /api/leads/import */
  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  importLeads(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded. Use field name "file".');
    }
    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Allowed: CSV, XLSX`,
      );
    }
    return this.leadsService.importFile(file);
  }

  /** POST /api/leads/seed */
  @Post('seed')
  seedMockData() {
    return this.leadsService.seedMockData();
  }

  /** DELETE /api/leads */
  @Delete()
  bulkDelete(@Body() dto: BulkDeleteDto) {
    return this.leadsService.bulkDelete(dto);
  }

  /** PATCH /api/leads/bulk-stage */
  @Patch('bulk-stage')
  bulkUpdateStage(@Body() dto: BulkStageDto) {
    return this.leadsService.bulkUpdateStage(dto);
  }

  /** PATCH /api/leads/bulk-status */
  @Patch('bulk-status')
  bulkUpdateStatus(@Body() dto: BulkStatusDto) {
    return this.leadsService.bulkUpdateStatus(dto);
  }

  /** PATCH /api/leads/bulk-schedule */
  @Patch('bulk-schedule')
  bulkScheduleFollowups(@Body() dto: BulkScheduleDto) {
    return this.leadsService.bulkScheduleFollowups(dto);
  }

  /** PATCH /api/leads/:id/stage */
  @Patch(':id/stage')
  advanceStage(@Param('id') id: string, @Body() dto: UpdateStageDto) {
    return this.leadsService.advanceStage(id, dto);
  }

  /** PATCH /api/leads/:id/checklist */
  @Patch(':id/checklist')
  updateChecklist(@Param('id') id: string, @Body() dto: UpdateChecklistDto) {
    return this.leadsService.updateChecklist(id, dto);
  }

  /** POST /api/leads/:id/note */
  @Post(':id/note')
  addNote(@Param('id') id: string, @Body() dto: AddNoteDto) {
    return this.leadsService.addNote(id, dto);
  }
}
