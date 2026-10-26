# 0190: Table exports are made in the browser and recorded first

Date: 2026-10-26 · Task: #102 (features "Exports"; additions flow 20)

**What.** Any console table exports the rows it shows, filtered and sorted, as CSV or XLSX, for staff who export tables (`exports.table`). The console's frame puts a `DataTableExportProvider` above every screen, so every `DataTable` offers Export CSV and Export XLSX without a screen doing anything. A screen with filters of its own names them (`exportFilter`): the days of Pot data and TDS, the day of the credit report and the register, the month of the MIS and the statements, the account of a statement, Members' tier and search. Members lists every member of a tier from the database (at most 5,000), so flow 20 exports the whole tier, not a search's first 200.

**Recorded first.** Before the file is saved, `record_table_export` writes the audit log: who (the actor, device and address the log always holds), what table, every filter in force, the format and the row count. An export that is not recorded saves nothing and says so.

**Large exports.** An export of `exports.alert_rows` rows or more (1,000 unless the venue sets it) raises an `export.large` alert for the owner, with the table, format and rows; the alert holds no personal data, the audit log holds who.

**Files in the browser.** The file is made from what the staff member already sees, so no data leaves the database that the screen did not already show. CSV cells are quoted and formula-safe with a byte-order mark; XLSX is one sheet, words as text and figures as numbers, written without a library: the parts of a workbook stored uncompressed in a zip (`exportFiles.ts`). A column can say what it exports (`exportValue`); otherwise a Money cell exports its rupees, a cell that sorts by a number exports the number, and any other the words it shows. Exports are recorded in the audit log, not an `export_job` table: the log already holds who, from which device and address, and the lane contract says so.

**Not here.** The super admin's full encrypted archive and the per-member export are #103.
