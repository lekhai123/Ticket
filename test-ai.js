const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config(); // Nếu bạn có dùng dotenv

async function testAI() {
  console.log("Bắt đầu test gọi API Gemini...");
  const startTime = Date.now();

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); // Hoặc điền cứng Key vào đây
    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

    const result = await model.generateContent(
      "Xin chào, hãy trả lời ngắn gọn: 1+1 bằng mấy?",
    );
    const response = await result.response;

    console.log(" Kết quả từ AI:", response.text());
    console.log(`⏱Thời gian phản hồi: ${Date.now() - startTime} ms`);
  } catch (error) {
    console.error(" Lỗi gọi AI:", error.message);
    console.log(`Thời gian chờ (bị lỗi): ${Date.now() - startTime} ms`);
  }
}

testAI();
