import { Field, ObjectType } from '@nestjs/graphql';
import { FindManyArgs } from '../args/FindManyArgs';

@ObjectType({ isAbstract: true })
export class PaginatedOutput<T> {
  constructor(data: T[], total: number, paginatedInput: FindManyArgs) {
    this.total = total;
    this.data = data;
    this.take = paginatedInput.take;
    this.page = paginatedInput.page;
    this.totalPages = Math.ceil(total / paginatedInput.take);
  }

  @Field()
  take: number;

  @Field()
  page: number;

  @Field()
  totalPages: number;

  @Field()
  total: number;

  data: T[];

  static for<T>(classRef: new () => T): any {
    @ObjectType({ isAbstract: true })
    abstract class PaginatedOutputClass extends PaginatedOutput<T> {
      @Field(() => [classRef], { nullable: true })
      data: T[];
    }
    return PaginatedOutputClass;
  }
}
