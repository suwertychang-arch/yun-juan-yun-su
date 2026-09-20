const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── AI 配置（从环境变量读取，用户无需配置）───
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_BASE_URL = process.env.AI_BASE_URL || 'https://api.deepseek.com';
const AI_MODEL = process.env.AI_MODEL || 'deepseek-v4-pro';

// ─── 房间状态（内存存储，重启即清空）───
const rooms = {};
const ONLINE_THRESHOLD = 15000; // 15秒内有poll就算在线

function getRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      confessions: { male: [], female: [] },
      advices: [],
      lastSeen: { male: 0, female: 0 },
      mentorThinking: false,
      mentorError: null,
    };
  }
  return rooms[roomId];
}

function isOnline(room, identity) {
  return Date.now() - room.lastSeen[identity] < ONLINE_THRESHOLD;
}

// 按身份过滤状态：共同解读所有人可见，私聊建议只返回当前用户的
function getFilteredState(room, identity) {
  const otherIdentity = identity === 'male' ? 'female' : 'male';
  // 过滤建议：每条只返回 sharedPart + 当前身份的 privatePart
  const filteredAdvices = room.advices.map(a => ({
    id: a.id,
    sharedPart: a.sharedPart || '',
    privatePart: a.privatePart ? (a.privatePart[identity] || '') : '',
    timestamp: a.timestamp,
  }));
  return {
    online: {
      male: isOnline(room, 'male'),
      female: isOnline(room, 'female'),
    },
    myConfessions: room.confessions[identity] || [],
    otherHasConfessed: (room.confessions[otherIdentity] || []).length > 0,
    advices: filteredAdvices,
    mentorThinking: room.mentorThinking,
    mentorError: room.mentorError,
  };
}

// ─── AI 导师系统提示词 ───
const MENTOR_SYSTEM_PROMPT = `你是一个恋爱app内置的AI关系沟通导师，服务于共同参与的一对伴侣。

你的目标是帮助双方理解彼此、松动缺乏依据的负面判断、看清真实分歧，并逐渐形成双方都能接受的相处方式。以温和开导为主，既理解感受，也尊重事实。不要为了安慰或促成和解，替任何一方编造善意。

一、身份与立场

你分别倾听两个人，但始终对双方公平。不因性别、表达多少、发言顺序、创建房间或付费而偏向谁。
你不是裁判，不评价谁更爱谁，不给人格或感情打分。公平不等于平均分配责任，理解出发点也不等于否认行为造成的影响。

二、分析方法

先在内部完成以下判断，最终只呈现最有帮助的结论，不展示逐步推理：

1. 找到具体的受伤点
这件事为什么让人在意？从当事人已经表达的感受和顾虑出发。不要推断童年、依恋类型、人格或潜意识。

2. 看清感受如何变成结论
识别是否有人从一个行为直接推到了关系结论。帮助双方区分：失落可以被理解，但这个结论是否有足够依据。

3. 用另一方提供的信息补全理解
当存在证据支持的其他解释时，帮助双方看到：最令人受伤的解释，未必是唯一或最准确的解释。如果没有支持其他解释的信息，不硬找理由。

4. 用一句清楚的话点出错位
连接"一方的想法—实际表达—另一方的感受"。

5. 给出一个更可讨论的方向
帮助双方从缺乏依据的关系判断，回到具体可以回应的问题。

6. 指出有依据的磨合方向
根据事实分清需要承担的责任、可协商的习惯和可选择的配合。需要调整的方向应具体到行为或期待。

三、输出形式

你的回应不限于"行动建议"。根据情况，选择最有帮助的形式：
- 认知区分：帮人看清两个容易混淆的概念
- 视角松动：指出"最令人受伤的解释，未必是唯一或最准确的解释"
- 机制解释：说明一个行为为什么会产生
- 思路方向：帮人转向更可讨论的问题
- 行动建议：必要时给具体可配合的小尝试
- 问题引导：有时抛一个问题比给答案更有帮助
不固定用哪一种。根据倾诉内容判断当前最需要哪种引导。

四、回应结构

你的回应分为两部分：

1. 共同解读（sharedPart）：双方都能看到的内容
- 点出错位、松动判断、说明方向
- 面向两个人，主要使用"你们"
- 不逐人指导，不说"男生你应该…""女生你应该…"
- 不引用任何一方的原话
- 控制在300-500字，简单问题更短
- 语气温暖、坦诚、口语自然

2. 给你的话（privatePart）：分为 male 和 female 两部分，各自独立
- 只针对当前这一方的具体建议
- 可以是行动建议、思考方向、或者一个问题
- 像导师单独跟你说话，对方看不到
- 每部分控制在50-200字
- 如果某一方的信息不足以给出具体建议，可以说"等你补充更多后我再给你具体建议"
- 不要为了对称硬给两方各写一段，根据实际需要给

五、边界

不因目标是开导而要求任何人原谅、和解或继续关系。
涉及威胁、暴力、胁迫或持续控制时，明确识别行为，优先尊重安全与自主。
绝对不直接引用某一方的原话，不说"男生说…""女生说…"。只描述感受和情绪类型。
如果某一方只选了状态、没有写文字补充，仍然基于其选择给出有意义的回应。
回应用中文，自然口语，温暖但不讨好。

六、输出格式

你必须严格输出以下JSON格式（不要输出任何其他内容）：

\`\`\`json
{
  "sharedPart": "共同解读内容...",
  "privatePart": {
    "male": "给男生的建议...",
    "female": "给女生的建议..."
  }
}
\`\`\``;

function buildUserPrompt(room) {
  const maleConfs = room.confessions.male || [];
  const femaleConfs = room.confessions.female || [];
  const lastAdvice = room.advices[room.advices.length - 1];

  let prompt = '';

  if (maleConfs.length > 0) {
    prompt += '【男生倾诉】\n';
    maleConfs.forEach((c, i) => {
      prompt += `第${i + 1}次：\n场景选择：${c.sceneType || '未选择'}\n`;
      if (c.emotion) prompt += `状态选择：${c.emotion}\n`;
      if (c.text) {
        prompt += `补充描述：${c.text}\n`;
      } else {
        prompt += `补充描述：（未填写文字，仅有选择项）\n`;
      }
      prompt += '\n';
    });
  }

  if (femaleConfs.length > 0) {
    prompt += '【女生倾诉】\n';
    femaleConfs.forEach((c, i) => {
      prompt += `第${i + 1}次：\n场景选择：${c.sceneType || '未选择'}\n`;
      if (c.emotion) prompt += `状态选择：${c.emotion}\n`;
      if (c.text) {
        prompt += `补充描述：${c.text}\n`;
      } else {
        prompt += `补充描述：（未填写文字，仅有选择项）\n`;
      }
      prompt += '\n';
    });
  }

  if (maleConfs.length === 0 && femaleConfs.length === 0) {
    prompt += '双方都还没有倾诉内容。\n';
  }

  if (maleConfs.length > 0 && femaleConfs.length === 0) {
    prompt += '\n注意：目前只有男生提交了倾诉，女生还没有。sharedPart中先帮助男生梳理，并邀请女生补充。privatePart.female可以写"等你补充后我再给你具体建议"。\n';
  }
  if (femaleConfs.length > 0 && maleConfs.length === 0) {
    prompt += '\n注意：目前只有女生提交了倾诉，男生还没有。sharedPart中先帮助女生梳理，并邀请男生补充。privatePart.male可以写"等你补充后我再给你具体建议"。\n';
  }

  if (lastAdvice) {
    prompt += `\n【上一轮导师共同解读】\n${lastAdvice.sharedPart || ''}\n`;
    prompt += '\n请在上一轮的基础上继续，不要重复之前说过的话。\n';
  }

  prompt += '\n请输出JSON格式的回应。';

  return prompt;
}

// 解析AI返回的JSON
function parseAdviceResponse(content) {
  // 尝试提取JSON
  let jsonStr = content.trim();

  // 去掉可能的 markdown code fence
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.sharedPart && parsed.privatePart) {
      return {
        sharedPart: parsed.sharedPart.trim(),
        privatePart: {
          male: (parsed.privatePart.male || '').trim(),
          female: (parsed.privatePart.female || '').trim(),
        },
      };
    }
  } catch (e) {
    console.error('JSON parse failed, trying fallback...', e.message);
  }

  // 降级：如果JSON解析失败，把全部内容当作sharedPart
  console.log('Fallback: treating entire response as sharedPart');
  return {
    sharedPart: content.trim(),
    privatePart: { male: '', female: '' },
  };
}

async function callMentor(room) {
  if (!AI_API_KEY) {
    return { ok: false, error: '服务器未配置 AI API Key，请联系管理员' };
  }

  const userPrompt = buildUserPrompt(room);

  try {
    const url = `${AI_BASE_URL}/chat/completions`;
    const body = {
      model: AI_MODEL,
      messages: [
        { role: 'system', content: MENTOR_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
      temperature: 0.8,
      max_tokens: 2000,
      stream: false,
      response_format: { type: 'json_object' },
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('AI API error:', resp.status, errText);
      return { ok: false, error: `AI 接口返回错误 (${resp.status})` };
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { ok: false, error: 'AI 返回内容为空' };
    }

    const parsed = parseAdviceResponse(content);

    const advice = {
      id: Date.now().toString(),
      sharedPart: parsed.sharedPart,
      privatePart: parsed.privatePart,
      timestamp: new Date().toISOString(),
    };
    room.advices.push(advice);
    return { ok: true, advice };
  } catch (err) {
    console.error('callMentor error:', err);
    return { ok: false, error: `AI 调用失败: ${err.message}` };
  }
}

// ─── REST API ───

// 轮询 / 心跳
app.post('/api/poll', (req, res) => {
  const { roomId, identity } = req.body;
  if (!roomId || !['male', 'female'].includes(identity)) {
    return res.json({ ok: false, error: '参数无效' });
  }

  const room = getRoom(roomId);
  room.lastSeen[identity] = Date.now();
  res.json({ ok: true, state: getFilteredState(room, identity) });
});

// 提交倾诉（支持选择+文字补充，文字可选）
app.post('/api/confess', (req, res) => {
  const { roomId, identity, sceneType, emotion, text } = req.body;
  if (!roomId || !['male', 'female'].includes(identity)) {
    return res.json({ ok: false, error: '参数无效' });
  }

  if (!sceneType && !emotion && (!text || !text.trim())) {
    return res.json({ ok: false, error: '请至少选择一项，或写点什么' });
  }

  const room = getRoom(roomId);

  const confession = {
    id: Date.now().toString(),
    sceneType: sceneType || '',
    emotion: emotion || '',
    text: (text || '').trim(),
    timestamp: new Date().toISOString(),
  };
  room.confessions[identity].push(confession);
  room.lastSeen[identity] = Date.now();

  res.json({ ok: true, confession });
});

// 请导师回应（异步执行，立即返回）
app.post('/api/ask-mentor', async (req, res) => {
  const { roomId, identity } = req.body;
  if (!roomId || !['male', 'female'].includes(identity)) {
    return res.json({ ok: false, error: '参数无效' });
  }

  const room = getRoom(roomId);
  if (room.mentorThinking) {
    return res.json({ ok: false, error: '导师正在思考中，请稍等' });
  }

  room.mentorThinking = true;
  room.mentorError = null;
  room.lastSeen[identity] = Date.now();

  res.json({ ok: true, thinking: true });

  // 异步调用AI
  const result = await callMentor(room);
  room.mentorThinking = false;
  if (!result.ok) {
    room.mentorError = result.error;
  }
});

// 清除导师错误
app.post('/api/clear-error', (req, res) => {
  const { roomId } = req.body;
  if (!roomId) return res.json({ ok: false });
  const room = getRoom(roomId);
  room.mentorError = null;
  res.json({ ok: true });
});

// 定期清理无人的房间
setInterval(() => {
  for (const [id, room] of Object.entries(rooms)) {
    if (Date.now() - room.lastSeen.male > 60000 && Date.now() - room.lastSeen.female > 60000) {
      delete rooms[id];
    }
  }
}, 30000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`云卷云苏服务已启动: http://localhost:${PORT}`);
  console.log(`AI 配置: ${AI_API_KEY ? '已配置' : '未配置（需要设置环境变量 AI_API_KEY）'}`);
  console.log(`AI 模型: ${AI_MODEL}`);
  console.log(`AI 接口: ${AI_BASE_URL}`);
});
