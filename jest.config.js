/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.ts"], // Hoặc '**/test/**/*.test.ts' nếu thư mục của bạn không có 's'
  setupFiles: ["dotenv/config"],
  verbose: true,
  forceExit: true,
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        //Bỏ qua kiểm tra TypeScript nghiêm ngặt khi test
        diagnostics: false,
      },
    ],
  },
};
