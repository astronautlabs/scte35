
/**
 * Implements CRC-32/MPEG-2
 * Online calculator: https://crccalc.com/
 * Specified in ITU-T H.222.0 Annex A: CRC decoder model
 * Takes hints from implementations found at https://stackoverflow.com/questions/54339800/how-to-modify-crc-32-to-crc-32-mpeg-2
 * 
 * @param message The data to calculate the checksum for
 */
export function crc32b(message : Buffer)
{
   let crc = BigInt(0xFFFFFFFF);
   let msb : bigint;
   
   for(let i = 0; i < message.length; i++) {
      crc = BigInt(0xFFFFFFFF) & (crc ^ ((BigInt(message[i]) & BigInt(0x000000FF)) * BigInt(0x1000000)));
      for (let j = 0; j < 8; j++) {
            msb = BigInt(!!(crc & BigInt(0x80000000)) ? 1 : 0);
            crc = (crc & BigInt(0x7fffffff)) * BigInt(0x2);
            crc ^= (BigInt(0) - msb) & BigInt(0x04C11DB7);
      }
   }
   return Number(crc);
}