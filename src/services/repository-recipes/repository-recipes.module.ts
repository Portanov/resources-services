import { Module } from '@nestjs/common';
import { RecetasRepositoryService } from './repository-recipes.service';

@Module({
  providers: [RecetasRepositoryService],
  exports: [RecetasRepositoryService],
})
export class RepositoryRecipesModule {}
