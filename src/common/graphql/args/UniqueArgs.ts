import { InputType, Field, ArgsType } from '@nestjs/graphql';

@ArgsType()
@InputType()
export class UniqueArgs {
  @Field()
  id: number;
}
