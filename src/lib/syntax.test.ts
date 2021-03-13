import { describe } from "razmin";
import { expect } from "chai";
import { SpliceInfoSection } from "./syntax";
import { BitstreamReader } from "@astronautlabs/bitstream";
import * as scte35 from './scte35';

describe("SCTE35", () => {
    describe("SpliceInfoSection", it => {
        it('can be read', async () => {
            const base64 = "/DBGAAET8J+pAP/wBQb+AAAAAAAwAi5DVUVJQAErgX+/CR9TSUdOQUw6OGlTdzllUWlGVndBQUFBQUFBQUJCQT09NwMDaJ6RZQ==";
            
            const cs35 = scte35.SCTE35.parseFromB64(base64);
            console.log(`CS35 (L1):`);
            console.dir(cs35);

            const reader = new BitstreamReader();
            reader.addBuffer(Buffer.from(base64, 'base64'));
    
            let spliceInfo = await SpliceInfoSection.read(reader);
    
            // Confirms that all 33 bits are read correctly
    
            console.log(`Resulting object:`);
            console.dir(spliceInfo);
    
            expect(spliceInfo.ptsAdjustment).to.eq(4629503913);
        });
        it.only('can handle a few', async () => {
            //const base64 = "/DBvAAFDizjpAP/wBQb+K9F+MgBZAhlDVUVJXAL02n+3AQpIRDExMjM0OFQxIQEAAh1DVUVJXAL2U3/3AAGb/KUBCUhEQ00xMDY0ODQAAAIdQ1VFSVwC9lR/9wAAKTGxAQlIRENNMTA2NDgwAADHDHPR";
            //const base64 = "/DAgAAAAAAAAAAAADwXgABFYf//+AUmXAAAAAAAAAGXUMaS0" // sl
            //const base64 = "/DAlAAAAAAAAAP/wFAUACGxPf+//4ZoIo/4AFfkAAAAAAAAAgJ61+A==" // live
            const base64 = "/DAlAAAAAAAAAP/wFAUACGxOf+//4Gcd9f4BIPDAAAAAAAAAnIWhIw=="; // 3.5m splice insert
            const cs35 = scte35.SCTE35.parseFromB64(base64);

            console.log(`CS35 (L2):`);
            console.dir(cs35);

            //const spliceInfo = scte35.SCTE35.parseFromB64(base64);
            const reader = new BitstreamReader();
            reader.addBuffer(Buffer.from(base64, 'base64'));
    
            let spliceInfo = await SpliceInfoSection.read(reader);
    
            // Confirms that all 33 bits are read correctly
    
            console.log(`Resulting object:`);
            console.dir(spliceInfo);
    
            expect(spliceInfo.ptsAdjustment).to.eq(4629503913);
        });
    });
});