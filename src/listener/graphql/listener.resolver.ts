import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ListenerService } from '../listener.service';
import { ListenerOutput } from './output/listener.output';
import { CreateListenerArgs } from './args/CreateListenerArgs';
import { SuccessOutput } from 'src/common/graphql/output/SuccessOutput';
import { UniqueArgs } from 'src/common/graphql/args/UniqueArgs';

@Resolver()
export class ListenerResolver {
  constructor(private readonly listenerService: ListenerService) {}

  @Query(() => [ListenerOutput])
  listeners(): ListenerOutput[] {
    return this.listenerService.findListeners();
  }

  @Mutation(() => ListenerOutput)
  async addListener(@Args() args: CreateListenerArgs): Promise<ListenerOutput> {
    return await this.listenerService.addListener(args);
  }

  @Mutation(() => SuccessOutput)
  async deleteListener(@Args() args: UniqueArgs): Promise<SuccessOutput> {
    await this.listenerService.stopListener(args.id);
    return { success: true };
  }
}
