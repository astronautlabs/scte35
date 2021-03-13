import "zone.js";
import "source-map-support/register";
import "reflect-metadata";
import { suite } from 'razmin';

//globalThis.BITSTREAM_TRACE = true;
suite().include(['./**/*.test.js']).run();