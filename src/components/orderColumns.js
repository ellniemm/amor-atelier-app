// Komponen client mengimpor logika kolom dari sini; implementasinya ada di
// src/lib/sheetFields.js supaya bisa dipakai bersama oleh kode server.
export {
  isDateHeader,
  isTimeHeader,
  isChoiceHeader,
  isPaymentHeader,
  isAddressHeader,
  isFileUploadHeader,
  extractDriveLink,
  pickLabelHeader,
  parseTimeRange,
  EDITING_SINCE_HEADER,
  LAST_UPDATE_HEADER,
  isEditingStatus,
  parseSheetDate,
  daysSince,
} from "@/lib/sheetFields";
