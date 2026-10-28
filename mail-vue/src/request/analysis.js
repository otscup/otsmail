import http from '@/axios/index.js'

export function analysisEcharts(timeZone) {
    return http.get('/analysis/echarts',{params: {timeZone}});
}

export function analysisInsight(range, timeZone) {
    return http.get('/analysis/insight',{params: {range, timeZone}});
}