import { BitstreamElement, Field, Variant, VariantMarker, DefaultVariant, Reserved, Marker } from "@astronautlabs/bitstream";
import { crc32b } from "./crc32";

export class SpliceTime extends BitstreamElement {
    @Field(1) specified : boolean;
    @Reserved(6, { presentWhen: i => i.specified }) reserved1 : number;
    @Field(33, { presentWhen: i => i.specified }) pts : number;
    @Reserved(7, { presentWhen: i => !i.specified }) reserved2 : number;
}

export class BreakDuration extends BitstreamElement {
    @Field(1) autoReturn : boolean;
    @Reserved(6) reserved : number;
    @Field(33) duration : number;
}

export class RegistrationDescriptor extends BitstreamElement {
    @Field(8) descriptorTag : number;
    @Field(8) descriptorLength : number;
    @Field(32) scteSpliceFormatIdentifier : number;
}

export class CueIdentifierDescriptor extends BitstreamElement {
    @Field(8) descriptorTag : number;
    @Field(8) descriptorLength : number;
    @Field(8) cueStreamType : number;
}

export class StreamIdentifierDescriptor extends BitstreamElement {
    @Field(8) descriptorTag : number;
    @Field(8) descriptorLength : number;
    @Field(8) componentTag : number;
}

export const SPLICE_COMMAND_NULL = 0x00;
export const SPLICE_COMMAND_SCHEDULE = 0x04;
export const SPLICE_COMMAND_INSERT = 0x05;
export const SPLICE_COMMAND_TIME_SIGNAL = 0x06;
export const SPLICE_COMMAND_BANDWIDTH_RESERVATION = 0x07;
export const SPLICE_COMMAND_PRIVATE_COMMAND = 0xff;

export class SpliceDescriptor extends BitstreamElement {
    @Field(8) tag : number;
    @Field(8, { 
        writtenValue: (i : SpliceDescriptor) => Math.ceil(i.measure(i => i.$startOfDescriptor, i => i.$endOfDescriptor) / 8) 
    })
    length : number;

    @Field(0) $startOfDescriptor;
    @Field(4, { string: { encoding: 'ascii' }}) identifier : string; // "CUEI" for SCTE-35
    @VariantMarker() $variant;

    @Field(0) $endOfDescriptorSyntax;
    
    @Field(i => i.length - i.measure(i => i.$startOfDescriptor, i => i.$endOfDescriptorSyntax) / 8) 
    remainder : Uint8Array;

    @Field(0) $endOfDescriptor;
}

@DefaultVariant()
export class UnknownSpliceDescriptor extends SpliceDescriptor {
    @Field((i : SpliceDescriptor) => (i.length * 8 - i.measureFrom(i => i.identifier)) / 8)
    private : Uint8Array;
}

export class SpliceInfoSection extends BitstreamElement {
    @Marker() $startOfSpliceInfoSection;

    @Field(8) tableId : number;
    @Field(1) sectionSyntax : boolean;
    @Field(1) private : boolean;
    @Reserved(2) reserved : number;

    @Field(12, { writtenValue: (i : SpliceInfoSection) => Math.ceil(i.measureFrom(i => i.protocolVersion) / 8) }) 
    sectionLength : number;

    @Field(8) protocolVersion : number;
    @Field(1) encrypted : boolean;
    @Field(6) encryptionAlgorithm : number;
    @Field(33) ptsAdjustment : number;
    @Field(8) cwIndex : number;
    @Field(12) tier : number;

    @Field(12, { 
        writtenValue: (i : SpliceInfoSection) => 
            Math.ceil(i.measure(i => i.$startOfSpliceCommand, i => i.$endOfSpliceCommand) / 8)
    })
    spliceCommandLength : number;

    @Field(8) spliceCommandType : number;

    @Field(0) $startOfSpliceCommand : never;

    @VariantMarker() $variant;

    @Field(0) $endOfSpliceCommand : never;

    @Field(16, {
        writtenValue: (i : SpliceInfoSection) => Math.ceil(i.measure(i => i.$startOfDescriptorLoop, i => i.$endOfDescriptorLoop) / 8)
    })
    descriptorLoopLength : number;

    @Field(0) $startOfDescriptorLoop : number;
    @Field(0, { 
        array: { 
            hasMore: (i : SpliceInfoSection) => {
                let remains = i.descriptorLoopLength * 8 - i.measureField(i => i.descriptors);
                //console.log(`******* REMAINS: ${remains}, my size: ${i.measureField(i => i.descriptors)}`);
                return remains > 0;
            }, 
            type: SpliceDescriptor 
        }
    })
    descriptors : SpliceDescriptor[];

    @Field(0) $endOfDescriptorLoop : number;

    // Encryption is not properly supported here. The amount of stuffing bytes is dependent on the encryption 
    // algorithm expected by the reader and the number of bytes that exist up to this point. 
    //stuffing : Uint8Array;

    @Field(32, { 
        presentWhen: i => i.encrypted 
    })
    encryptionChecksum : number;

    @Marker() $endOfChecksummedRegion;

    @Field(32, {
        writtenValue: (i : SpliceInfoSection) => 
            crc32b(i.serialize(i => i.$startOfSpliceInfoSection, i => i.$endOfChecksummedRegion))
    })
    checksum : number;
    
}

@Variant<SpliceInfoSection>(i => i.spliceCommandType == SPLICE_COMMAND_PRIVATE_COMMAND)
export class PrivateCommandSplice extends SpliceInfoSection {
    @Field(32) identifier : number;
    @Field((i : PrivateCommandSplice) => (Math.floor(i.sectionLength * 8 - i.measureFrom(i => i.protocolVersion)) / 8)) 
    buffer : Uint8Array;
}

@Variant((i : SpliceDescriptor) => i.identifier === 'CUEI' && i.tag === 0x00)
export class AvailDescriptor extends SpliceDescriptor {
    @Field(32) providerAvailId : number;
}

@Variant((i : SpliceDescriptor) => i.identifier === 'CUEI' && i.tag === 0x01)
export class DTMFDescriptor extends SpliceDescriptor {
    @Field(8) preroll : number;
    @Field(3) dtmfCount : number;
    @Reserved(5) reserved : number;
    @Field(i => i.dtmfCount) chars : Uint8Array;
}

@Variant((i : SpliceDescriptor) => i.identifier === 'CUEI' && i.tag === 0x02)
export class SegmentationDescriptor extends SpliceDescriptor {
    @Field(32) eventId : number;
    @Field(1) canceled : boolean;
    @Reserved(7) reserved : number;
}

@Variant((i : SpliceDescriptor) => i.identifier === 'CUEI' && i.tag === 0x03)
export class TimeDescriptor {
    @Field(48) seconds : number;
    @Field(32) nanoseconds : number;
    @Field(16) utcOffset : number;
}

export class AudioDescriptorComponent extends BitstreamElement {
    @Field(8) tag : number;
    @Field(24) isoCode : number;
    @Field(3) bitstreamMode : number;
    @Field(4) channels : number;
    @Field(1) isFullService : boolean;
}

@Variant((i : SpliceDescriptor) => i.identifier === 'CUEI' && i.tag === 0x04)
export class AudioDescriptor {
    @Field(4) count : number;
    @Reserved(4) reserved : number;
    @Field(0, { array: { count: i => i.count, type: AudioDescriptorComponent }})
    components : AudioDescriptorComponent[];
}

export class SegmentationComponent extends BitstreamElement {
    @Field(8) tag : number;
    @Reserved(7) reserved : number;
    @Field(33) ptsOffset : number;
}

@Variant((i : SegmentationDescriptor) => !i.canceled)
export class NewSegmentationDescriptor extends SegmentationDescriptor {
    @Field(1) hasProgram : boolean;
    @Field(1) hasDuration : boolean;
    @Field(1) deliveryNotRestricted : boolean;
    @Field(1, { presentWhen: i => !i.deliveryNotRestricted }) webDeliveryAllowed : boolean;
    @Field(1, { presentWhen: i => !i.deliveryNotRestricted }) noRegionalBlackout : boolean;
    @Field(1, { presentWhen: i => !i.deliveryNotRestricted }) archiveAllowed : boolean;
    @Field(2, { presentWhen: i => !i.deliveryNotRestricted }) deviceRestrictions : number;

    @Reserved(5, { presentWhen: i => i.deliveryNotRestricted }) 
    reserved : number;

    @Field(0, { array: { countFieldLength: 8, type: SegmentationComponent }, presentWhen: i => !i.hasProgram })
    components : SegmentationComponent[];

    @Field(40, { presentWhen: i => i.hasDuration })
    duration : number;

    @Field(8) upidType : number;
    @Field(8) upidLength : number;
    @Field(i => i.upidLength * 8) upid : Uint8Array;
    @Field(8) typeId : number;
    @Field(8) segmentNumber : number;
    @Field(8) segmentsExpected : number;
    @Field(8, { 
        presentWhen: i => [0x34, 0x36, 0x38, 0x3A].includes(i.typeId) && (i.length - i.measureFrom(i => i.$startOfDescriptor) / 8) > 0
    }) 
    subSegmentNumber : number;
    
    @Field(8, { 
        presentWhen: i => [0x34, 0x36, 0x38, 0x3A].includes(i.typeId) && (i.length - i.measureFrom(i => i.$startOfDescriptor) / 8) > 0
    }) 
    subSegmentsExpected : number;
}

@Variant<SpliceInfoSection>(i => i.spliceCommandType == SPLICE_COMMAND_NULL)
export class SpliceNull extends SpliceInfoSection {
}

@Variant<SpliceInfoSection>(i => i.spliceCommandType == SPLICE_COMMAND_SCHEDULE)
export class ScheduledSplice extends BitstreamElement {
    @Field(8) id : number;
    @Field(1) canceled : boolean;
    @Reserved(7) reserved1 : number;
}

export class ComponentSpliceTime extends BitstreamElement {
    @Field(8) tag : number;
    @Field(0, { presentWhen: (i, p) => p && p.immediate }) time : SpliceTime;
}

@Variant<SpliceInfoSection>(i => i.spliceCommandType == SPLICE_COMMAND_INSERT)
export class InsertedSplice extends SpliceInfoSection {
    @Field(32) id : number;
    @Field(1) canceled : boolean;
    @Reserved(7) reserved1 : number;
}

@Variant<InsertedSplice>(i => i.canceled)
export class CancelInsertedSplice extends InsertedSplice {}

@Variant<InsertedSplice>(i => !i.canceled)
export class NewInsertedSplice extends InsertedSplice {
    @Field(1) outOfNetwork : boolean;
    @Field(1) programSplice : boolean;
    @Field(1) duration : boolean;
    @Field(1) immediate : boolean;
    @Reserved(4) reserved2 : number;

    @Field(0, { presentWhen: i => i.programSplice && !i.immediate }) 
    time : SpliceTime;

    @Field(32, { array: { countFieldLength: 8, type: ComponentSpliceTime }, presentWhen: i => !i.programSplice }) 
    components : ComponentSpliceTime[];

    @Field(0, { presentWhen: i => i.duration })
    breakDuration : BreakDuration;

    @Field(16) uniqueProgramId : number;
    @Field(8) availNumber : number;
    @Field(8) availsExpected : number;
}

@Variant<SpliceInfoSection>(i => i.spliceCommandType == SPLICE_COMMAND_TIME_SIGNAL)
export class TimeSignalSplice extends SpliceInfoSection {
    @Field() spliceTime : SpliceTime;
}

@Variant<SpliceInfoSection>(i => i.spliceCommandType == SPLICE_COMMAND_BANDWIDTH_RESERVATION)
export class BandwidthReservationSplice extends SpliceInfoSection {
}

@Variant<ScheduledSplice>(i => i.canceled)
export class CancelScheduledSplice extends ScheduledSplice {}

export class ComponentSpliceUTC extends BitstreamElement {
    @Field(8) tag : number;
    @Field(32) utcSpliceTime : number;
}

@Variant<ScheduledSplice>(i => !i.canceled)
export class NewScheduledSplice extends ScheduledSplice {
    @Field(1) outOfNetwork : boolean;
    @Field(1) programSplice : boolean;
    @Field(1) duration : boolean;
    @Reserved(5) reserved2 : number;

    @Field(32, { presentWhen: i => i.programSplice }) utcSpliceTime : number;
    @Field(32, { array: { countFieldLength: 8, type: ComponentSpliceUTC }, presentWhen: i => !i.programSplice }) 
    components : ComponentSpliceUTC[];

    @Field(0, { presentWhen: i => i.duration })
    breakDuration : BreakDuration;

    @Field(16) uniqueProgramId : number;
    @Field(8) availNumber : number;
    @Field(8) availsExpected : number;
}

export class SpliceSchedule extends SpliceInfoSection {
    @Field(0, { array: { countFieldLength: 8, type: NewScheduledSplice } }) 
    splices : NewScheduledSplice[];
}