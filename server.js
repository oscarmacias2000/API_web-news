import YahooFinance from 'yahoo-finance2';
import express from 'express';
import cors from 'cors';

const yahooFinance = new YahooFinance({ 
    suppressNotices: ['yahooSurvey', 'ripHistorical'] 
});
const app = express();
const port = 3001;

app.use(cors());

// Endpoint 1: Precio actual
app.get('/api/quote/:symbol', async (req, res) => {
    const symbol = req.params.symbol;
    console.log(`📊 Buscando: ${symbol}`);
    
    try {
        const result = await yahooFinance.quote(symbol);
        res.json({
            symbol: result.symbol,
            regularMarketPrice: result.regularMarketPrice,
            currency: result.currency,
            regularMarketChange: result.regularMarketChange,
            regularMarketChangePercent: result.regularMarketChangePercent,
            longName: result.longName,
            marketState: result.marketState
        });
    } catch (error) {
        console.error(`❌ Error con ${symbol}:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint 2: Máximo histórico (usando historical)
app.get('/api/historical-high/:symbol', async (req, res) => {
    const symbol = req.params.symbol;
    
    // ✅ Usar objeto Date, NO timestamps en segundos
    const endDate = new Date();                                    // Hoy
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 10);           // Hace 10 años
    
    console.log(`📈 Buscando máximo histórico para: ${symbol}`);
    
    try {
        // ✅ historical() es más estable y simple que chart()
        const historicalData = await yahooFinance.historical(symbol, {
            period1: startDate,    // ✅ objeto Date
            period2: endDate,      // ✅ objeto Date
            interval: '1d',        // '1d', '1wk', o '1mo'
            includeAdjustedClose: true
        });
        
        if (!historicalData || historicalData.length === 0) {
            return res.status(404).json({ error: `No se encontró historial para ${symbol}` });
        }
        
        // Encontrar el máximo (all-time high)
        let allTimeHigh = { value: -Infinity, date: null };
        for (const bar of historicalData) {
            const price = bar.adjClose || bar.close;
            if (price && price > allTimeHigh.value) {
                allTimeHigh.value = price;
                allTimeHigh.date = bar.date;
            }
        }
        
        if (allTimeHigh.value === -Infinity) {
            return res.status(404).json({ error: `No se encontraron precios válidos para ${symbol}` });
        }
        
        res.json({
            symbol: symbol,
            allTimeHigh: allTimeHigh.value,
            date: allTimeHigh.date,
            message: `Máximo histórico de ${symbol} en los últimos 10 años`
        });
        
    } catch (error) {
        console.error(` Error histórico con ${symbol}:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// ✅ NUEVO Endpoint 3: Historial de últimos meses
app.get('/api/history/:symbol/:months', async (req, res) => {
    const symbol = req.params.symbol;
    const months = parseInt(req.params.months) || 3; // Por defecto 3 meses
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    
    console.log(`📜 Buscando historial de ${months} meses para: ${symbol}`);
    
    try {
        const historicalData = await yahooFinance.historical(symbol, {
            period1: startDate,
            period2: endDate,
            interval: '1d'
        });
        
        if (!historicalData || historicalData.length === 0) {
            return res.status(404).json({ error: `No se encontró historial para ${symbol}` });
        }
        
        // Formatear datos para enviar al frontend
        const history = historicalData.map(bar => ({
            date: bar.date.toISOString().split('T')[0], // YYYY-MM-DD
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume
        }));
        
        res.json({
            symbol: symbol,
            months: months,
            count: history.length,
            data: history
        });
        
    } catch (error) {
        console.error(`❌ Error histórico con ${symbol}:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`\n Servidor corriendo en http://localhost:${port}`);
    console.log(` Endpoint precio: http://localhost:3001/api/quote/AAPL`);
    console.log(` Endpoint máximo histórico: http://localhost:3001/api/historical-high/AAPL\n`);
});