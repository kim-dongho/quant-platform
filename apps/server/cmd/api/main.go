package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// 1. 데이터 모델 정의 (DB 테이블 'market_data'와 매핑)
type MarketData struct {
	Time   time.Time `json:"time" gorm:"primaryKey"`
	Symbol string    `json:"symbol" gorm:"primaryKey"`
	Open   float64   `json:"open"`
	High   float64   `json:"high"`
	Low    float64   `json:"low"`
	Close  float64   `json:"close"`
	Volume int64     `json:"volume"`
}

// 테이블 이름을 강제로 지정 (GORM은 기본적으로 복수형을 찾으므로)
func (MarketData) TableName() string {
	return "market_data"
}

var db *gorm.DB

func main() {
	// 2. 웹 서버(Fiber) 생성
	app := fiber.New()

	// 3. CORS 허용 (프론트엔드인 localhost:3000에서 요청할 수 있게)
	app.Use(cors.New())

	// 4. 데이터베이스 연결
	connectDB()

	// 5. 라우팅 설정
	// 예: http://localhost:8080/api/stocks/RKLB/history
	api := app.Group("/api")
	api.Get("/stocks/:symbol/history", getStockHistory)

	// 6. 서버 시작
	log.Fatal(app.Listen(":8080"))
}

func connectDB() {
	dsn := os.Getenv("DB_DSN")
	if dsn == "" {
		dsn = "host=localhost user=user password=password dbname=quant port=5432 sslmode=disable"
	}

	var err error

	// 🔄 재시도 로직: 30초 동안 1초 간격으로 접속 시도
	for i := 0; i < 30; i++ {
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
			Logger: logger.Default.LogMode(logger.Info),
		})

		if err == nil {
			fmt.Println("✅ DB 연결 성공!")
			return // 연결되면 함수 종료
		}

		fmt.Printf("⏳ DB 연결 대기 중... (%d/30)\n", i+1)
		time.Sleep(1 * time.Second) // 1초 쉬고 다시 시도
	}

	// 30번 다 실패하면 그때 죽음
	log.Fatal("❌ DB 연결 최종 실패:", err)
}

// API 핸들러: 특정 종목의 전체 기록 조회
func getStockHistory(c *fiber.Ctx) error {
	symbol := c.Params("symbol") // URL에서 종목 코드 추출
	var history []MarketData

	// 쿼리 실행: 해당 심볼 검색 & 시간순 정렬
	result := db.Where("symbol = ?", symbol).Order("time asc").Find(&history)

	if result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "데이터 조회 실패"})
	}

	return c.JSON(history)
}
