import { InputType, Field, ArgsType } from '@nestjs/graphql';

@ArgsType()
@InputType()
export class CreateListenerArgs {
  @Field()
  apiId: number;

  @Field()
  apiHash: string;

  @Field()
  phone: string;

  @Field({ nullable: true, defaultValue: '' })
  stringSession: string;
}
