import { ArgsType, Field, InputType } from '@nestjs/graphql';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

@ArgsType()
@InputType()
export class FindManyArgs {
  constructor(args?: { page?: number; take?: number; skip?: number }) {
    if (!args) {
      return;
    }
    const { page, take, skip } = args;
    if (page && take) {
      this.page = page;
      this.take = take;
    } else if (take && skip) {
      if (skip !== 0 && skip % take !== 0) {
        throw new Error('skip must be a multiple of take');
      }
      this.take = take;
      this.page = skip / take + 1;
    } else {
      this.page = page ?? 1;
      this.take = take ?? 20;
    }
  }

  @IsInt()
  @Min(1)
  @IsOptional()
  @Field({ nullable: true, defaultValue: 1 })
  page: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Field({ nullable: true, defaultValue: 20 })
  take: number;

  get skip(): number {
    return (this.page - 1) * this.take;
  }

  static getSkip(page: number, take: number): number {
    return (page - 1) * take;
  }
}
