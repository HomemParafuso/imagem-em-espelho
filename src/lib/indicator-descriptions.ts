export const categoryDescriptions: Record<string, string> = {
  Adicionados:
    "Indicadores já adicionados ao gráfico, com controles de visibilidade e configuração.",
  Scripts: "Scripts personalizados adicionados pelo usuário e executados sobre os candles reais.",
  Popular: "Indicadores mais usados para leitura rápida de tendência, força e volatilidade.",
  Momentum: "Indicadores que medem força, velocidade e possíveis mudanças do movimento do preço.",
  Tendência: "Indicadores que ajudam a identificar direção, continuidade e reversão de tendência.",
  Volatilidade: "Indicadores que medem amplitude, faixas e intensidade das oscilações do preço.",
  "Médias móveis": "Médias usadas para suavizar o preço e acompanhar a tendência atual.",
  Volume: "Indicadores derivados do volume ou do fluxo de negociações do ativo.",
};

export const indicatorDescriptions: Record<string, string> = {
  "Suporte e resistência":
    "Calcula máximas e mínimas dos períodos configurados e atualiza níveis horizontais conforme chegam novos candles.",
  EMA: "Média móvel exponencial: dá mais peso aos preços recentes e acompanha o preço mais rapidamente.",
  SMA: "Média móvel simples: calcula a média aritmética dos fechamentos do período selecionado.",
  Alligator:
    "Combina médias suavizadas para indicar tendência, direção e períodos de consolidação.",
  "Average Directional Movement Index":
    "Mede a força da tendência; não indica sozinho se o movimento é de alta ou de baixa.",
  "Average True Range": "Mede a volatilidade média usando a amplitude verdadeira dos candles.",
  "Awesome Oscillator": "Compara médias do ponto médio dos candles para mostrar força do momentum.",
  "Bollinger Bands":
    "Cria uma média central e bandas que se expandem ou contraem conforme a volatilidade.",
  "Commodity Channel Index":
    "Compara o preço atual com sua média estatística para indicar desvios e momentum.",
  "Detrended Price Oscillator (DPO)":
    "Remove a tendência principal para destacar ciclos e oscilações de curto prazo.",
  Fractal: "Marca padrões locais de máximas e mínimas formados por candles vizinhos.",
  MACD: "Compara médias exponenciais para mostrar direção, momentum e cruzamentos.",
  Momentum: "Compara o preço atual com o preço de um período anterior para medir velocidade.",
  "Aroon Oscillator":
    "Avalia há quanto tempo ocorreram as máximas e mínimas recentes para indicar tendência.",
  "Balance of Power":
    "Estima o domínio dos compradores ou vendedores pela relação entre abertura, fechamento e faixa.",
  "Belkhayate Timing":
    "Oscilador de timing usado para localizar mudanças de ritmo e possíveis reversões.",
  "Center of Gravity":
    "Usa uma ponderação dos preços para localizar o centro do movimento recente.",
  "Chande Forecast Oscillator":
    "Compara preço observado e preço projetado para medir força e possíveis extremos.",
  "Chande Momentum Oscillator": "Mede momentum líquido usando ganhos e perdas dentro do período.",
  DeMarker: "Compara máximas e mínimas recentes para indicar pressão compradora ou vendedora.",
  "DiNapoli MACD": "Variação do MACD com parâmetros de DiNapoli para acompanhar momentum.",
  "DiNapoli Preferred Stochastic":
    "Oscilador estocástico parametrizado para localizar zonas de excesso.",
  "ATR Trailing Stops": "Calcula um stop móvel baseado na volatilidade medida pelo ATR.",
  Aroon: "Indica a presença e a força de uma tendência a partir da idade das máximas e mínimas.",
  "Bollinger Bands %B":
    "Mostra a posição do preço dentro das bandas de Bollinger em escala percentual.",
  "Chop Zone": "Classifica visualmente períodos de tendência e congestão do preço.",
  "Darvas Box": "Forma caixas com máximas e mínimas para destacar rompimentos de faixa.",
  "Disparity Index": "Mede a distância percentual entre o preço e sua média móvel.",
  "Ehler Fisher Transform": "Transforma o preço para realçar pontos de reversão e extremos.",
  "Elder Impulse System": "Combina tendência e momentum para classificar o impulso de cada candle.",
  "Ichimoku Cloud":
    "Exibe equilíbrio, suporte, resistência, direção e momentum em múltiplas linhas.",
  "ATR Bands": "Cria faixas ao redor do preço usando múltiplos da volatilidade do ATR.",
  "Chaikin Volatility": "Mede a variação da amplitude das máximas e mínimas ao longo do tempo.",
  "Donchian Channels":
    "Mostra as máximas e mínimas de um período para acompanhar faixas e rompimentos.",
  "Donchian Width": "Mede a largura do canal de Donchian como sinal de expansão ou compressão.",
  "Gopalakrishnan Range Index":
    "Avalia a expansão da faixa de preços em relação ao tamanho do período.",
  "High Low Bands": "Desenha bandas baseadas nas máximas e mínimas recentes.",
  "Historical Volatility": "Estima a volatilidade histórica a partir das variações dos preços.",
  "Keltner Channels": "Cria canais em torno de uma média usando o ATR como medida de amplitude.",
  "Relative Volatility": "Compara a volatilidade atual com a volatilidade observada anteriormente.",
  "Arnaud Legoux Moving Average (ALMA)":
    "Média suavizada com ponderação ajustável para reduzir ruído e atraso.",
  Envelopes: "Cria bandas percentuais acima e abaixo de uma média móvel.",
  "Kaufman's Adaptive Moving Average (KAMA)":
    "Adapta a suavização conforme eficiência e ruído do movimento.",
  "Least Squares Moving Average (LSMA)":
    "Usa regressão linear para acompanhar a direção estimada do preço.",
  "Moving Average Deviation": "Exibe o desvio do preço ou da média em relação à média móvel.",
  "Rainbow Moving Averages":
    "Empilha médias com períodos diferentes para visualizar tendência e compressão.",
  "Accumulation/Distribution":
    "Relaciona fechamento e volume para estimar acumulação ou distribuição.",
  "Net Volume": "Mostra o volume líquido separado entre candles de alta e de baixa.",
  "Volume Oscillator":
    "Compara médias de volume de períodos diferentes para indicar expansão ou retração.",
  "Weis Wave Volume":
    "Agrupa volume por ondas de movimento para comparar pressão compradora e vendedora.",
};
