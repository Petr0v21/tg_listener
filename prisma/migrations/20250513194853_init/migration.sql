-- CreateTable
CREATE TABLE "listeners" (
    "api_id" INTEGER NOT NULL,
    "api_hash" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "stringSession" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listeners_pkey" PRIMARY KEY ("api_id")
);
