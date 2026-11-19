# 0705 An export records the rows it read

Date: 19 Nov 2026. Issue 1015, logic review of #1104.

- Activity's count now stops five thousand lines past the page asked for (`activity_page`), so a long log's total can be a floor. The screen says so: "50 of 5,050+" (`is_total_at_least`, `DataTableServer.isTotalAtLeast`).
- Until now a server-mode export was recorded first, with the server's total, and its rows were read after that (decision 0611). With a floor for a total, the record would hold a number the file does not.
- Now a server-mode export reads every row the view leaves, then records how many it read, then saves the file. Decision 0190 still holds: nothing is saved unless it is recorded, and an export whose rows cannot be read saves nothing and says so.
- The rows read are ones the staff member may already page through on screen; reading them before the record leaves nothing outside the browser.
- The large-export alert (`exports.alert_rows`) now counts the rows actually exported.
