
import * as echarts from 'echarts/core';

import { BarChart,PieChart,LineChart,GaugeChart,HeatmapChart} from 'echarts/charts';
// 寮曞叆鏍囬锛屾彁绀烘锛岀洿瑙掑潗鏍囩郴锛屾暟鎹泦锛屽唴缃暟鎹浆鎹㈠櫒缁勪欢锛岀粍浠跺悗缂€閮戒负 Component
import {
    TooltipComponent,
    GridComponent,
    VisualMapComponent,
} from 'echarts/components';
// 鏍囩鑷姩甯冨眬銆佸叏灞€杩囨浮鍔ㄧ敾绛夌壒鎬?
// 寮曞叆 Canvas 娓叉煋鍣紝娉ㄦ剰寮曞叆 CanvasRenderer 鎴栬€?SVGRenderer 鏄繀椤荤殑涓€姝?
import { CanvasRenderer } from 'echarts/renderers';
import { LegendComponent } from 'echarts/components';
// 娉ㄥ唽蹇呴』鐨勭粍浠?
echarts.use([
    GaugeChart,
    LegendComponent,
    PieChart,
    TooltipComponent,
    GridComponent,
    BarChart,
    LineChart,
    HeatmapChart,
    VisualMapComponent,
    CanvasRenderer
]);

export default echarts
