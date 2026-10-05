import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Paginated, paginate } from '../common/dto/pagination-query.dto';
import { textPattern } from '../common/dto/query-helpers';
import { ProgramsService } from '../programs/programs.service';
import { CreateSubjectDto, SubjectsQueryDto, UpdateSubjectDto } from './dto/subject.dto';
import { Subject, SubjectDocument } from './schemas/subject.schema';

@Injectable()
export class SubjectsService {
  constructor(
    @InjectModel(Subject.name) private readonly model: Model<SubjectDocument>,
    private readonly programsService: ProgramsService,
  ) {}

  async create(dto: CreateSubjectDto): Promise<SubjectDocument> {
    await this.assertProgramActive(dto.program);
    await this.assertPrerequisitesExist(dto.prerequisites ?? []);
    return this.model.create(dto);
  }

  async findAll(query: SubjectsQueryDto): Promise<Paginated<Subject>> {
    const filter: FilterQuery<SubjectDocument> = {};
    if (query.program) filter.program = query.program;
    if (query.semester) filter.semester = query.semester;
    if (query.active !== undefined) filter.active = query.active;
    if (query.q) {
      const pattern = textPattern(query.q);
      filter.$or = [{ code: pattern }, { name: pattern }];
    }
    const [data, total] = await Promise.all([
      this.model
        .find(filter)
        .populate('prerequisites', 'code name')
        .sort({ semester: 1, code: 1 })
        .skip(query.skip)
        .limit(query.limit)
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return paginate(data, total, query);
  }

  async findOne(id: string): Promise<SubjectDocument> {
    const subject = await this.model.findById(id).populate('prerequisites', 'code name').exec();
    if (!subject) throw new NotFoundException('Materia no encontrada');
    return subject;
  }

  async update(id: string, dto: UpdateSubjectDto): Promise<SubjectDocument> {
    if (dto.program) await this.assertProgramActive(dto.program);
    if (dto.prerequisites) {
      await this.assertPrerequisitesExist(dto.prerequisites);
      await this.assertNoCycle(id, dto.prerequisites);
    }
    const subject = await this.model
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .populate('prerequisites', 'code name')
      .exec();
    if (!subject) throw new NotFoundException('Materia no encontrada');
    return subject;
  }

  // Suma los creditos de un conjunto de materias (para el limite de creditos por periodo)
  async totalCredits(ids: Types.ObjectId[]): Promise<number> {
    if (ids.length === 0) return 0;
    const [result] = await this.model.aggregate<{ total: number }>([
      { $match: { _id: { $in: ids } } },
      { $group: { _id: null, total: { $sum: '$credits' } } },
    ]);
    return result?.total ?? 0;
  }

  private async assertProgramActive(programId: string): Promise<void> {
    const program = await this.programsService.findOne(programId);
    if (!program.active) throw new BadRequestException('El programa esta inactivo');
  }

  private async assertPrerequisitesExist(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const found = await this.model.countDocuments({ _id: { $in: ids } }).exec();
    if (found !== ids.length) {
      throw new BadRequestException('Alguno de los prerrequisitos no existe');
    }
  }

  // Evita ciclos: A requiere B y B requiere A (directa o indirectamente)
  private async assertNoCycle(subjectId: string, prerequisites: string[]): Promise<void> {
    const visited = new Set<string>();
    let frontier = [...prerequisites];

    while (frontier.length > 0) {
      if (frontier.includes(subjectId)) {
        throw new BadRequestException('Los prerrequisitos generan un ciclo');
      }
      frontier.forEach((id) => visited.add(id));

      const parents = await this.model
        .find({ _id: { $in: frontier } }, { prerequisites: 1 })
        .exec();
      frontier = parents
        .flatMap((p) => p.prerequisites.map(String))
        .filter((id) => !visited.has(id));
    }
  }
}
