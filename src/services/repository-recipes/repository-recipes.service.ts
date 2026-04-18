import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface RecetaEpicurious {
  title?: string;
  name?: string;
  directions: string[];
  fat: number | null;
  date: string;
  categories: string[];
  calories: number | null;
  desc: string | null;
  protein: number | null;
  rating: number | null;
  ingredients: string[];
  sodium: number | null;
}

interface BuscarRecetasSegurasFiltros {
  kcal_objetivo: number;
  margen: number;
  ingredientes_prohibidos: string[];
  etiquetas_requeridas?: string[];
  maxResultados?: number;
}

function isRecetaEpicurious(value: unknown): value is RecetaEpicurious {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const tieneNombre =
    typeof candidate.title === 'string' || typeof candidate.name === 'string';
  const tieneDirections =
    Array.isArray(candidate.directions) &&
    candidate.directions.every((item) => typeof item === 'string');
  const tieneIngredientes =
    Array.isArray(candidate.ingredients) &&
    candidate.ingredients.every((item) => typeof item === 'string');
  const tieneCategorias =
    Array.isArray(candidate.categories) &&
    candidate.categories.every((item) => typeof item === 'string');

  return (
    tieneNombre &&
    tieneDirections &&
    typeof candidate.date === 'string' &&
    typeof candidate.calories === 'number' &&
    typeof candidate.protein === 'number' &&
    typeof candidate.fat === 'number' &&
    typeof candidate.sodium === 'number' &&
    tieneIngredientes &&
    tieneCategorias
  );
}

@Injectable()
export class RecetasRepositoryService implements OnModuleInit {
  private recetas: RecetaEpicurious[] = [];

  onModuleInit() {
    const datasetPath = path.join(
      process.cwd(),
      'src',
      'services',
      'repository-recipes',
      'data',
      'full_format_recipes.json',
    );

    const data = fs.readFileSync(datasetPath, 'utf8');
    const parsed: unknown = JSON.parse(data);

    this.recetas = Array.isArray(parsed)
      ? parsed.filter(isRecetaEpicurious)
      : [];

    console.log(
      `Dataset de Epicurious cargado: ${this.recetas.length} recetas.`,
    );
  }

  buscarRecetasSeguras(
    filtros: BuscarRecetasSegurasFiltros,
  ): RecetaEpicurious[] {
    return this.recetas
      .filter((receta) => {
        if (
          receta.calories === null ||
          receta.protein === null ||
          receta.fat === null ||
          receta.sodium === null
        ) {
          return false;
        }

        const cumpleKcal =
          receta.calories >= filtros.kcal_objetivo - filtros.margen &&
          receta.calories <= filtros.kcal_objetivo + filtros.margen;

        if (!cumpleKcal) return false;

        const tieneProhibidos = filtros.ingredientes_prohibidos.some(
          (prohibido) => {
            const regex = new RegExp(prohibido, 'i');
            return receta.ingredients.some((ing) => regex.test(ing));
          },
        );

        if (tieneProhibidos) return false;

        if (filtros.etiquetas_requeridas?.length) {
          return filtros.etiquetas_requeridas.every((tag) =>
            receta.categories.includes(tag),
          );
        }

        return true;
      })
      .slice(0, filtros.maxResultados ?? 15);
  }

  extraerNombreReceta(receta: RecetaEpicurious): string {
    return receta.title ?? receta.name ?? 'receta_sin_nombre';
  }
}
