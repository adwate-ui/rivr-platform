# 0074 Certification quizzes run in the practice venue, on the console, marked by the database

Date: 20 Oct 2026. Task #50.

The tech plan puts the dealer and cashier certification quizzes inside the practice venue, with a pass recorded against the staff record. So the quizzes (`quiz`) exist only in practice venues: the migration adds them to every practice venue, and `bootstrap_venue` to a new one. Staff take them on the console's Certification screen with the console switched to the practice venue; at the club the screen says so. Each attempt (`quiz_attempt`) is kept on the staff record of whoever took it, at the practice venue; staff who manage staff see every attempt there, everyone else their own.

The console, not the tablet: a tablet signs in dealers only to deal a down at its table, and every dealer can sign in to the console with their number, as at the club. The tablet's part in training is to say when it stands in the practice venue (`my_device().is_practice`), so a training tablet is never taken for a live one.

The right answers never reach a client: `answer_key` is not granted, nor an attempt's `answers` (a perfect attempt's answers are the key), and neither table is in the audit log, whose readers would see both. `submit_quiz` marks the answers, records the attempt and returns only the score. Any staff member may take either quiz; the certificate is the pass on their record, whatever their role. Every attempt is kept, so the attempts list shows a pass that took many tries. Like every write, a quiz is refused while the venue is frozen.

The questions are this system's own procedures, written for it; no book content. Editing them on the console is a later task: they change through a migration for now.
