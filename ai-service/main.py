main.pyfrom fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="NexusTicket AI Dynamic Pricing Engine")

class PricingState(BaseModel):
    empty_seat_ratio: float      # Tỷ lệ ghế trống (0.0 -> 1.0)
    time_to_departure_hrs: float # Số giờ còn lại trước khi chạy
    predicted_demand: float      # Nhu cầu dự báo từ Time-Series
    booking_velocity: int        # Số vé đặt trong 5 phút qua

@app.get("/health")
def health_check():
    return {"status": "ok", "model": "DQN-v1-ready"}

@app.post("/predict-price-multiplier")
def predict_multiplier(state: PricingState):
    # Sau khi Thành viên 2 train xong file model.onnx sẽ load vào đây
    # Hiện tại trả về logic mẫu để Frontend (TV3) và Tester (TV4) làm việc trước
    multiplier = 1.0
    if state.empty_seat_ratio < 0.2 and state.booking_velocity > 5:
        multiplier = 1.15  # Tăng 15% khi ghế sắp hết và tốc độ mua cao
    elif state.empty_seat_ratio > 0.7 and state.time_to_departure_hrs < 12:
        multiplier = 0.90  # Giảm 10% kích cầu khi sát giờ mà còn trống nhiều
        
    return {
        "multiplier": multiplier,
        "action_Adjust_percent": round((multiplier - 1.0) * 100, 1)
    }