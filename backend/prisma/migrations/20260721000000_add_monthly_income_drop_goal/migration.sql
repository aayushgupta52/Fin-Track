-- AlterTable: add the primary income metric that the app is now built around.
ALTER TABLE "User" ADD COLUMN "monthlyIncome" DOUBLE PRECISION;

-- DropTable: the Goals module has been removed.
DROP TABLE IF EXISTS "Goal";
