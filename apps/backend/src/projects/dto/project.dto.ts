import { createZodDto } from 'nestjs-zod';
import {
  bulkMoveResultSchema,
  createProjectSchema,
  projectSchema,
  updateProjectSchema,
} from '@infra/shared';

export class ProjectDto extends createZodDto(projectSchema) {}
export class CreateProjectDto extends createZodDto(createProjectSchema) {}
export class UpdateProjectDto extends createZodDto(updateProjectSchema) {}
export class BulkMoveResultDto extends createZodDto(bulkMoveResultSchema) {}
