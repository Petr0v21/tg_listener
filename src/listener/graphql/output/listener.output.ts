import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class ListenerOutput {
  @Field()
  apiId: number;
}
