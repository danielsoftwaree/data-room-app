import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema';

@Injectable()
export class EnvService {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService<Env, true>) {}

  get<TKey extends keyof Env>(key: TKey): Env[TKey] {
    return this.configService.get<Env[TKey]>(key);
  }
}
