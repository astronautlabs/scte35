import { describe } from "razmin";
import { expect } from "chai";
import { NewInsertedSplice, NewSegmentationDescriptor, SpliceInfoSection, TimeSignalSplice } from "./syntax";
import { BitstreamReader, BitstreamWriter } from "@astronautlabs/bitstream";
import { WritableStreamBuffer } from 'stream-buffers';
import { crc32b } from "./crc32";

describe("CRC32", it => {
    it('handles the zero byte', async () => {
        expect(crc32b(Buffer.from([ 0 ]))).to.equal(0x4E08BFB4);
    });
    
    it('handles the one byte', async () => {
        expect(crc32b(Buffer.from([ 1 ]))).to.equal(0x4AC9A203);
    });
    
    it('handles the two byte', async () => {
        expect(crc32b(Buffer.from([ 2 ]))).to.equal(0x478A84DA);
    });

    it('verifies all samples', async () => {
        let samples = [
            "/DBGAAET8J+pAP/wBQb+AAAAAAAwAi5DVUVJQAErgX+/CR9TSUdOQUw6OGlTdzllUWlGVndBQUFBQUFBQUJCQT09NwMDaJ6RZQ==",
            "/DBvAAFDizjpAP/wBQb+K9F+MgBZAhlDVUVJXAL02n+3AQpIRDExMjM0OFQxIQEAAh1DVUVJXAL2U3/3AAGb/KUBCUhEQ00xMDY0ODQAAAIdQ1VFSVwC9lR/9wAAKTGxAQlIRENNMTA2NDgwAADHDHPR",
            "/DAgAAAAAAAAAAAADwXgABFYf//+AUmXAAAAAAAAAGUNffkA",
            "/DAlAAAAAAAAAP/wFAUACGxPf+//4ZoIo/4AFfkAAAAAAAAAgJ61+A=="
        ];

        for (let sample of samples) {
            let buf = Buffer.from(sample, "base64");
            let content = buf.slice(0, buf.length - 4);
            let str = content.toString('hex');
            let calced = crc32b(content);
            let expected = buf.readUInt32BE(buf.length - 4);

            if (calced !== expected) {
                console.log(` Checksum does not match:`);
                console.log(`   base64: ${sample}`);
                console.log(`      hex: ${str}`);
                console.log(` expected: 0x${expected.toString(16)} [${expected}]`);
                //console.log(`should be: 0x${1755222373..toString(16)}`);
                console.log(`   actual: 0x${calced.toString(16)} [${calced}]`);

                expect(calced).to.equal(buf.readUInt32BE(buf.length - 4));
            }
        }

    });
});

describe("SCTE35", () => {
    describe("SpliceInfoSection", it => {
        it('can roundtrip all samples', async () => {
            const base64s = [
                "/DBGAAET8J+pAP/wBQb+AAAAAAAwAi5DVUVJQAErgX+/CR9TSUdOQUw6OGlTdzllUWlGVndBQUFBQUFBQUJCQT09NwMDaJ6RZQ==",
                "/DBvAAFDizjpAP/wBQb+K9F+MgBZAhlDVUVJXAL02n+/AQpIRDExMjM0OFQxIQEAAh1DVUVJXAL2U3//AAGb/KUBCUhEQ00xMDY0ODQAAAIdQ1VFSVwC9lR//wAAKTGxAQlIRENNMTA2NDgwAAAkMywl",
                "/DAgAAAAAAAAAAAADwXgABFYf//+AUmXAAAAAAAAAGUNffk=",
                "/DAlAAAAAAAAAP/wFAUACGxPf+//4ZoIo/4AFfkAAAAAAAAAgJ61+A=="
            ];

            for (let base64 of base64s) {
                const reader = new BitstreamReader();
                reader.addBuffer(Buffer.from(base64, 'base64'));
        
                let spliceInfo = await SpliceInfoSection.readBlocking(reader);

                const streamBuf = new WritableStreamBuffer();
                const writer = new BitstreamWriter(streamBuf);
                await spliceInfo.write(writer);

                let buf = <Buffer>streamBuf.getContents();
                let newBase64 = buf.toString('base64');

                if (newBase64 !== base64) {
                    
                    let content = buf.slice(0, buf.length - 4);
                    let str = content.toString('hex');

                    console.log(`Roundtrip failed`);
                    console.log(` -   Checksummable: ${str}`);
                    console.log(` -        Checksum: 0x${crc32b(content).toString(16)} [${crc32b(content)}]`);
                    console.log(` - 1st trip base64: ${base64}`);
                    console.log(` - 2nd trip base64: ${newBase64}`);
                    
                    console.log(` - 1st trip @/scte35:`);
                    console.dir(spliceInfo);

                    globalThis.BITSTREAM_TRACE = true;
                    const reader = new BitstreamReader();
                    reader.addBuffer(Buffer.from(newBase64, 'base64'));

                    let spliceInfo2 = await SpliceInfoSection.readBlocking(reader);

                    console.log(` - 2nd trip @/scte35:`);
                    console.dir(spliceInfo2);

                    throw new Error(`The roundtripped base64 did not match the original!`);
                }
            }
        });

        it('can read a TimeSignalSplice with a single segmentation descriptor', async () => {
            const base64 = "/DBGAAET8J+pAP/wBQb+AAAAAAAwAi5DVUVJQAErgX+/CR9TSUdOQUw6OGlTdzllUWlGVndBQUFBQUFBQUJCQT09NwMDaJ6RZQ==";
            const reader = new BitstreamReader();
            reader.addBuffer(Buffer.from(base64, 'base64'));
    
            let spliceInfo = await SpliceInfoSection.readBlocking(reader);
    
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
        
        it('can read a complex TimeSignalSplice with 3 segmentation descriptors, with one provider opportunity which omits the optional subSegment fields', async() => {
            const base64 = '/DBvAAFDizjpAP/wBQb+K9F+MgBZAhlDVUVJXAL02n+3AQpIRDExMjM0OFQxIQEAAh1DVUVJXAL2U3/3AAGb/KUBCUhEQ00xMDY0ODQAAAIdQ1VFSVwC9lR/9wAAKTGxAQlIRENNMTA2NDgwAADHDHPR';
            const reader = new BitstreamReader();
            reader.addBuffer(Buffer.from(base64, 'base64'));

            let spliceInfo = await SpliceInfoSection.readBlocking(reader);
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
                expect(descriptor1.subSegmentNumber).not.to.exist;
                expect(descriptor1.subSegmentsExpected).not.to.exist;
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

        it('can read a complex TimeSignalSplice with 3 segmentation descriptors, with one provider opportunity', async() => {
            const base64 = '/DBvAAFDizjpAP/wBQb+K9F+MgBZAhlDVUVJXAL02n+3AQpIRDExMjM0OFQxIQEAAh9DVUVJXAL2U3/3AAGb/KUBCUhEQ00xMDY0ODQAAAECAh1DVUVJXAL2VH/3AAApMbEBCUhEQ00xMDY0ODAAAMcMc9E=';
            const reader = new BitstreamReader();
            reader.addBuffer(Buffer.from(base64, 'base64'));

            let spliceInfo = await SpliceInfoSection.readBlocking(reader);
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
        it('can read an immediate splice insert with 4m duration, with an extra byte appended', async() => {
            const base64 = '/DAgAAAAAAAAAAAADwXgABFYf//+AUmXAAAAAAAAAGUNffk=';
            const reader = new BitstreamReader();
            reader.addBuffer(Buffer.from(base64, 'base64'));

            let spliceInfo = await SpliceInfoSection.readBlocking(reader);
            expect(spliceInfo.checksum).to.equal(1695383033);
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
        it('can read a 16s splice insert', async () => {
            const base64 = "/DAlAAAAAAAAAP/wFAUACGxPf+//4ZoIo/4AFfkAAAAAAAAAgJ61+A==" // 16s break
            const reader = new BitstreamReader();
            reader.addBuffer(Buffer.from(base64, 'base64'));
    
            let spliceInfo = await SpliceInfoSection.readBlocking(reader);
    
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
        it('can read a 3.5m splice insert', async () => {
            const base64 = "/DAlAAAAAAAAAP/wFAUACGxOf+//4Gcd9f4BIPDAAAAAAAAAnIWhIw=="; // 3.5m splice insert
            const reader = new BitstreamReader();
            reader.addBuffer(Buffer.from(base64, 'base64'));
    
            let spliceInfo = await SpliceInfoSection.readBlocking(reader);
    
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