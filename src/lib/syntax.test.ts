import { describe } from "razmin";
import { expect } from "chai";
import { NewInsertedSplice, NewSegmentationDescriptor, SpliceInfoSection, TimeSignalSplice } from "./syntax";
import { BitstreamReader } from "@astronautlabs/bitstream";
import * as scte35 from './scte35';

describe("SCTE35", () => {
    describe("SpliceInfoSection", it => {
        it('can handle a TimeSignalSplice with a single segmentation descriptor', async () => {
            const base64 = "/DBGAAET8J+pAP/wBQb+AAAAAAAwAi5DVUVJQAErgX+/CR9TSUdOQUw6OGlTdzllUWlGVndBQUFBQUFBQUJCQT09NwMDaJ6RZQ==";
            const reader = new BitstreamReader();
            reader.addBuffer(Buffer.from(base64, 'base64'));
    
            let spliceInfo = await SpliceInfoSection.read(reader);
    
            // Confirms that all 33 bits are read correctly
    
            // console.log(`Resulting object:`);
            // console.dir(spliceInfo);
    
            expect(spliceInfo.tableId).to.equal(252);
            expect(spliceInfo.checksum).to.equal(1755222373);
            expect(spliceInfo.ptsAdjustment).to.equal(4629503913);
            expect(spliceInfo.descriptors.length).to.equal(1);
            let descriptor = spliceInfo.descriptors[0];
            expect(descriptor.tag).to.equal(2);
            expect(descriptor.identifier).to.equal('CUEI');
            expect(descriptor instanceof NewSegmentationDescriptor).to.be.true;
            if (descriptor instanceof NewSegmentationDescriptor) {
                expect(descriptor.hasProgram).to.be.true;
                expect(descriptor.hasDuration).to.be.false;
                expect(descriptor.typeId).to.equal(55);
                expect(descriptor.segmentNumber).to.equal(3);
                expect(descriptor.segmentsExpected).to.equal(3);
            }
        });
        
        // This one is broken. It comes from the Comcast SCTE35 parser test suite but is missing the subSegment bytes
        //const base64 = '/DBvAAFDizjpAP/wBQb+K9F+MgBZAhlDVUVJXAL02n+3AQpIRDExMjM0OFQxIQEAAh1DVUVJXAL2U3/3AAGb/KUBCUhEQ00xMDY0ODQAAAIdQ1VFSVwC9lR/9wAAKTGxAQlIRENNMTA2NDgwAADHDHPR';

        it('can handle a complex TimeSignalSplice with 3 segmentation descriptors, with one provider opportunity', async() => {
            const base64 = '/DBvAAFDizjpAP/wBQb+K9F+MgBZAhlDVUVJXAL02n+3AQpIRDExMjM0OFQxIQEAAh1DVUVJXAL2U3/3AAGb/KUBCUhEQ00xMDY0ODQAAAECAh1DVUVJXAL2VH/3AAApMbEBCUhEQ00xMDY0ODAAAMcMc9E=';
            const reader = new BitstreamReader();
            reader.addBuffer(Buffer.from(base64, 'base64'));
    
            // const cs35 = scte35.SCTE35.parseFromB64(base64);
            // console.log(`CS35 (L1):`);
            // console.dir(cs35);

            let spliceInfo = await SpliceInfoSection.read(reader);
            //console.dir(spliceInfo);

            expect(spliceInfo.tableId).to.equal(252);
            expect(spliceInfo.checksum).to.equal(3339482065);
            expect(spliceInfo instanceof TimeSignalSplice).to.be.true;
            expect(spliceInfo.descriptors.length).to.equal(3);
            expect(spliceInfo.descriptors[0] instanceof NewSegmentationDescriptor);
            expect(spliceInfo.descriptors[1] instanceof NewSegmentationDescriptor);
            expect(spliceInfo.descriptors[2] instanceof NewSegmentationDescriptor);

            let descriptor0 = spliceInfo.descriptors[0];
            if (descriptor0 instanceof NewSegmentationDescriptor) {
                expect(descriptor0.upid.toString('ascii')).to.equal('HD112348T1');
                expect(descriptor0.hasDuration).to.be.false;
                expect(descriptor0.duration).not.to.exist;
            }

            let descriptor1 = spliceInfo.descriptors[1];
            if (descriptor1 instanceof NewSegmentationDescriptor) {
                expect(descriptor1.upid.toString('ascii')).to.equal('HDCM10648');
                expect(descriptor1.subSegmentNumber).to.equal(1);
                expect(descriptor1.subSegmentsExpected).to.equal(2);
                expect(descriptor1.hasDuration).to.be.true;
                expect(descriptor1.duration).to.equal(26999973);
            }

            let descriptor2 = spliceInfo.descriptors[2];
            if (descriptor2 instanceof NewSegmentationDescriptor) {
                expect(descriptor2.upid.toString('ascii')).to.equal('HDCM10648');
                expect(descriptor2.hasDuration).to.be.true;
                expect(descriptor2.duration).to.equal(2699697);
            }

            if (spliceInfo instanceof TimeSignalSplice) {
                expect(spliceInfo.spliceTime).to.exist;
                expect(spliceInfo.spliceTime.specified).to.be.true;
                expect(spliceInfo.spliceTime.pts).to.equal(735149618);
            }
        });
        it('can handle an immediate splice insert with 4m duration, with an extra byte appended', async() => {
            const base64 = '/DAgAAAAAAAAAAAADwXgABFYf//+AUmXAAAAAAAAAGXUMaS0';
            const reader = new BitstreamReader();
            reader.addBuffer(Buffer.from(base64, 'base64'));
    
            // const cs35 = scte35.SCTE35.parseFromB64(base64);
            // console.log(`CS35 (L1):`);
            // console.dir(cs35);

            let spliceInfo = await SpliceInfoSection.read(reader);
    
            expect(spliceInfo.checksum).to.equal(1708405156);
            expect(spliceInfo instanceof NewInsertedSplice).to.be.true;
            if (spliceInfo instanceof NewInsertedSplice) {
                expect(spliceInfo.ptsAdjustment).to.equal(0);
                expect(spliceInfo.canceled).to.be.false;
                expect(spliceInfo.outOfNetwork).to.be.true;
                expect(spliceInfo.programSplice).to.be.true;
                expect(spliceInfo.immediate).to.be.true;
                expect(spliceInfo.time).not.to.exist;
                expect(spliceInfo.breakDuration.autoReturn).to.be.true;
                expect(spliceInfo.breakDuration.duration).to.equal(21600000); // 240 seconds
            }
        })
        it('can handle a 16s splice insert', async () => {
            const base64 = "/DAlAAAAAAAAAP/wFAUACGxPf+//4ZoIo/4AFfkAAAAAAAAAgJ61+A==" // 16s break
            const reader = new BitstreamReader();
            reader.addBuffer(Buffer.from(base64, 'base64'));
    
            let spliceInfo = await SpliceInfoSection.read(reader);
    
            expect(spliceInfo.checksum).to.equal(2157884920);
            expect(spliceInfo instanceof NewInsertedSplice).to.be.true;

            if (spliceInfo instanceof NewInsertedSplice) {
                expect(spliceInfo.ptsAdjustment).to.equal(0);
                expect(spliceInfo.canceled).to.be.false;
                expect(spliceInfo.outOfNetwork).to.be.true;
                expect(spliceInfo.programSplice).to.be.true;
                expect(spliceInfo.immediate).to.be.false;
                expect(spliceInfo.time.pts).to.equal(8079935651); // 8059821557
                expect(spliceInfo.breakDuration.duration).to.equal(1440000); // 16 seconds
            }
        });
        it('can handle a 3.5m splice insert', async () => {
            const base64 = "/DAlAAAAAAAAAP/wFAUACGxOf+//4Gcd9f4BIPDAAAAAAAAAnIWhIw=="; // 3.5m splice insert

            //const spliceInfo = scte35.SCTE35.parseFromB64(base64);
            //console.log(`CS35 (L1):`);
            //console.dir(cs35);

            const reader = new BitstreamReader();
            reader.addBuffer(Buffer.from(base64, 'base64'));
    
            let spliceInfo = await SpliceInfoSection.read(reader);
    
            expect(spliceInfo.checksum).to.equal(2626003235);
            expect(spliceInfo instanceof NewInsertedSplice).to.be.true;

            if (spliceInfo instanceof NewInsertedSplice) {
                expect(spliceInfo.ptsAdjustment).to.equal(0);
                expect(spliceInfo.canceled).to.be.false;
                expect(spliceInfo.outOfNetwork).to.be.true;
                expect(spliceInfo.programSplice).to.be.true;
                expect(spliceInfo.immediate).to.be.false;
                expect(spliceInfo.time.pts).to.equal(8059821557);
                expect(spliceInfo.breakDuration.duration).to.equal(18936000); // 210 seconds & 11 frames @ 29.97fps
            }
        });
    });
});