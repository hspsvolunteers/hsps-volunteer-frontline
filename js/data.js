/* =========================================================
   支援前線｜遊戲資料（隊伍 + 題庫）
   修改題目只需要編輯這個檔案
   ========================================================= */

window.GAME_DATA = {
  /* 名次遞減計分：第 1 名 +4、第 2 名 +3 ... */
  points: [4, 3, 2, 1],

  teams: [
    { id: 'blue', order: '第一組', name: '藍皮皮', leader: '良燕', key: '1' },
    { id: 'yellow', order: '第二組', name: '黃皮皮', leader: '詩嫻', key: '2' },
    { id: 'red', order: '第三組', name: '紅皮皮', leader: '昭華', key: '3' },
    { id: 'purple', order: '第四組', name: '紫皮皮', leader: '元玉', key: '4' }
  ],

  rounds: [
    {
      title: '第一回合',
      theme: '課業輔導',
      intro: [
        '開學啦！',
        '小朋友進度跟不上怎麼辦？',
        '課業輔導組來幫忙！'
      ],
      groups: [
        { name: '國輔組', leader: '怡如', supply: '文具', quantity: 5, unit: '件' },
        { name: '英輔組', leader: '依倫', supply: '英文元素物品', quantity: 3, unit: '件' },
        { name: '數輔組', leader: '寧翔', supply: '有數字元素的物品', quantity: 3, unit: '件' }
      ]
    },
    {
      title: '第二回合',
      theme: '體表會總動員',
      intro: [
        '體表會即將展開，校園花草需要修剪，',
        '圖書館開放參觀，',
        '比賽時需要導護志工維護比賽場地安全。',
        '請看各組所需支援物品！'
      ],
      groups: [
        { name: '園藝組', leader: '純敏', supply: '綠色元素物品', quantity: 3, unit: '件' },
        { name: '圖書組', leader: '維雲', supply: '紙製品', quantity: 3, unit: '件' },
        { name: '交通組', leader: '瑞芳', supply: '鑰匙、雨具', quantity: 2, unit: '件' }
      ]
    },
    {
      title: '第三回合',
      theme: '學期中任務',
      intro: [
        '學期中志工團也有重要任務！',
        '請看題目！'
      ],
      groups: [
        { name: '生活媽媽', leader: '淑慧', supply: '購物袋', quantity: 1, unit: '個' },
        { name: '健服組', leader: '心茹', supply: '保健防護用品', quantity: 4, unit: '件' },
        { name: '安全照護組', leader: '瑩臻', supply: '手錶', quantity: 2, unit: '支' }
      ]
    },
    {
      title: '第四回合',
      theme: '資深推薦組別',
      intro: [
        '有些志工組別是需要志願服務滿一年後',
        '由各組組長推薦才能加入的組別，',
        '究竟是哪些組別呢？'
      ],
      /* 本回合物資藏在演藝廳角落：畫面會顯示尋寶提示 */
      treasure: '尋寶任務｜以下物資都藏在演藝廳的角落，快派皮皮出動搜索！',
      groups: [
        { name: '茶藝組', leader: '瑩臻', supply: '茶元素物品', quantity: 1, unit: '件' },
        { name: '人資組', leader: '杏如', supply: '志工背心', quantity: 1, unit: '件' },
        { name: '熊熊組', leader: '怡如', supply: '玩偶', quantity: 1, unit: '隻' },
        { name: '資訊美編組', leader: '孟孺', supply: '膠帶、剪刀、美工用品', quantity: 1, unit: '件' }
      ]
    }
  ]
};
