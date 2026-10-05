import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, PopulateOptions } from 'mongoose';
import { Paginated, paginate } from '../common/dto/pagination-query.dto';
import { TeachersService } from '../teachers/teachers.service';
import { CreateFacultyDto, FacultiesQueryDto, UpdateFacultyDto } from './dto/faculty.dto';
import { Faculty, FacultyDocument } from './schemas/faculty.schema';

const POPULATE: PopulateOptions = {
  path: 'dean',
  select: 'code user',
  populate: { path: 'user', select: 'name' },
};

@Injectable()
export class FacultiesService {
  constructor(
    @InjectModel(Faculty.name) private readonly model: Model<FacultyDocument>,
    private readonly teachersService: TeachersService,
  ) {}

  async create(dto: CreateFacultyDto): Promise<FacultyDocument> {
    if (dto.dean) throw new BadRequestException('Asigna el decano despues de crear la facultad');
    return this.model.create(dto);
  }

  async findAll(query: FacultiesQueryDto): Promise<Paginated<Faculty>> {
    const filter: FilterQuery<FacultyDocument> = query.campus ? { campus: query.campus } : {};
    const [data, total] = await Promise.all([
      this.model.find(filter).sort({ campus: 1, name: 1 }).skip(query.skip).limit(query.limit).populate(POPULATE).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return paginate(data, total, query);
  }

  async findOne(id: string): Promise<FacultyDocument> {
    const faculty = await this.model.findById(id).populate(POPULATE).exec();
    if (!faculty) throw new NotFoundException('Facultad no encontrada');
    return faculty;
  }

  async update(id: string, dto: UpdateFacultyDto): Promise<FacultyDocument> {
    if (dto.dean) await this.assertDean(dto.dean, id);
    const faculty = await this.model.findByIdAndUpdate(id, dto, { new: true, runValidators: true }).populate(POPULATE).exec();
    if (!faculty) throw new NotFoundException('Facultad no encontrada');
    return faculty;
  }

  private async assertDean(teacherId: string, facultyId: string): Promise<void> {
    const teacher = await this.teachersService.findOne(teacherId);
    if (!teacher.active) throw new BadRequestException('El docente esta inactivo y no puede ser decano');
    if (String(teacher.faculty) !== facultyId) {
      throw new BadRequestException('El docente debe pertenecer a la facultad para ser decano');
    }
  }
}
