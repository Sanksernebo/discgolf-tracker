-- AlterTable
ALTER TABLE `Admin` ADD COLUMN `name` VARCHAR(100) NULL,
    ADD COLUMN `lastLoginAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `AdminLoginEvent` (
    `id` VARCHAR(191) NOT NULL,
    `adminId` VARCHAR(191) NOT NULL,
    `ip` VARCHAR(64) NULL,
    `userAgent` VARCHAR(300) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminLoginEvent_adminId_createdAt_idx`(`adminId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` VARCHAR(191) NOT NULL,
    `adminId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PasswordResetToken_tokenHash_key`(`tokenHash`),
    INDEX `PasswordResetToken_adminId_idx`(`adminId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AdminLoginEvent` ADD CONSTRAINT `AdminLoginEvent_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `Admin`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `Admin`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
