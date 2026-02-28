# AI 智能助手项目规划

## 项目概述

基于 Spring AI 框架构建的多模态 AI 智能助手，支持对话、图片生成、语音识别，集成高德地图服务和 RAG 知识检索。

---

## 技术栈

| 类别 | 技术选型 |
|------|----------|
| **后端框架** | Spring Boot 3.2+ / Spring AI |
| **AI 模型** | 硅基流动 (SiliconFlow) API |
| **主数据库** | MySQL 8.0 |
| **向量数据库** | Redis Stack |
| **地图服务** | 高德地图 API (通过 MCP) |
| **前端** | Vue 3 + Element Plus / React |
| **构建工具** | Maven |

---

## AI 模型配置

### 硅基流动免费模型

| 模型 | 用途 | API 名称 |
|------|------|----------|
| THUDM/glm-4-9b-chat | 对话/文本生成 | `glm-4-9b-chat` |
| Kwai-Kolors/Kolors | 图片生成 | `Kolors` |
| TeleAI/TeleSpeechASR | 语音识别 | `TeleSpeechASR` |

### API 配置示例

```yaml
spring:
  ai:
    openai:
      api-key: ${SILICONFLOW_API_KEY}
      base-url: https://api.siliconflow.cn/v1
      chat:
        options:
          model: THUDM/glm-4-9b-chat
      image:
        options:
          model: Kwai-Kolors/Kolors
```

---

## 项目架构

```
┌─────────────────────────────────────────────────────────────┐
│                      前端 (Web UI)                          │
│              Vue 3 / React + Element Plus                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway Layer                        │
│                  (Spring MVC REST)                          │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Chat Service │    │ Image Service │    │ Voice Service │
│    对话模块    │    │   图片模块     │    │   语音模块     │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Spring AI Layer                          │
│         (统一抽象 - ChatClient / ImageClient)               │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ SiliconFlow   │    │ Memory System │    │  Map Service  │
│   AI Models   │    │ 记忆 + RAG    │    │   高德地图     │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│    HTTP       │    │ Redis Stack   │    │   MCP Client  │
│  API Calls    │    │    + MySQL    │    │   高德API     │
└───────────────┘    └───────────────┘    └───────────────┘
```

---

## 模块划分

### 后端模块结构

```
ai-assistant/
├── pom.xml
├── src/main/java/com/ai/assistant/
│   ├── AiAssistantApplication.java
│   │
│   ├── config/                    # 配置类
│   │   ├── SiliconFlowConfig.java
│   │   ├── RedisConfig.java
│   │   ├── McpConfig.java
│   │   └── SecurityConfig.java
│   │
│   ├── controller/                # API控制器
│   │   ├── ChatController.java
│   │   ├── ImageController.java
│   │   ├── VoiceController.java
│   │   └── MapController.java
│   │
│   ├── service/                   # 业务服务
│   │   ├── chat/
│   │   │   ├── ChatService.java
│   │   │   └── ChatServiceImpl.java
│   │   ├── image/
│   │   │   ├── ImageService.java
│   │   │   └── ImageServiceImpl.java
│   │   ├── voice/
│   │   │   ├── VoiceService.java
│   │   │   └── VoiceServiceImpl.java
│   │   ├── memory/
│   │   │   ├── MemoryService.java
│   │   │   └── ConversationMemory.java
│   │   ├── rag/
│   │   │   ├── RagService.java
│   │   │   └── EmbeddingService.java
│   │   └── map/
│   │       ├── MapService.java
│   │       └── AmapMcpClient.java
│   │
│   ├── model/                     # 数据模型
│   │   ├── entity/
│   │   │   ├── User.java
│   │   │   ├── Conversation.java
│   │   │   ├── Message.java
│   │   │   └── KnowledgeDocument.java
│   │   ├── dto/
│   │   │   ├── ChatRequest.java
│   │   │   ├── ChatResponse.java
│   │   │   ├── ImageRequest.java
│   │   │   └── VoiceTranscribeRequest.java
│   │   └── vo/
│   │
│   ├── repository/                # 数据访问
│   │   ├── UserRepository.java
│   │   ├── ConversationRepository.java
│   │   └── MessageRepository.java
│   │
│   ├── mcp/                       # MCP集成
│   │   ├── McpClient.java
│   │   └── AmapMcpServer.java
│   │
│   └── util/                      # 工具类
│       ├── VectorUtils.java
│       └── AudioUtils.java
│
└── src/main/resources/
    ├── application.yml
    ├── application-dev.yml
    └── application-prod.yml
```

---

## 数据库设计

### MySQL 表结构

#### 1. 用户表 (users)

```sql
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    avatar VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### 2. 会话表 (conversations)

```sql
CREATE TABLE conversations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    title VARCHAR(255),
    model_type VARCHAR(50) COMMENT 'chat/image/voice',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### 3. 消息表 (messages)

```sql
CREATE TABLE messages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    conversation_id BIGINT NOT NULL,
    role ENUM('user', 'assistant', 'system') NOT NULL,
    content TEXT NOT NULL,
    content_type ENUM('text', 'image', 'audio') DEFAULT 'text',
    token_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### 4. 知识文档表 (knowledge_documents)

```sql
CREATE TABLE knowledge_documents (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255),
    content TEXT NOT NULL,
    source VARCHAR(500),
    doc_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_doc_type (doc_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Redis Stack 向量存储

#### 向量索引设计

```redis
# 创建向量索引
FT.CREATE knowledge_idx
ON JSON
PREFIX 1 doc:
SCHEMA
    $.content AS content TEXT
    $.embedding AS embedding VECTOR FLAT 6
        TYPE FLOAT32
        DIM 768
        DISTANCE_METRIC COSINE
    $.doc_id AS doc_id NUMERIC
    $.created_at AS created_at NUMERIC SORTABLE
```

#### 数据存储格式

```json
{
    "doc_id": 1,
    "content": "文档内容...",
    "embedding": [0.1, 0.2, ...],  // 768维向量
    "source": "来源",
    "created_at": 1709012345
}
```

---

## 核心功能实现

### 1. 对话功能 (Chat)

```java
@Service
public class ChatServiceImpl implements ChatService {

    private final ChatClient chatClient;
    private final MemoryService memoryService;
    private final RagService ragService;

    public ChatResponse chat(ChatRequest request) {
        // 1. 获取历史记忆
        List<Message> history = memoryService.getHistory(request.getConversationId());

        // 2. RAG检索相关知识
        List<String> context = ragService.retrieve(request.getContent());

        // 3. 构建Prompt
        String prompt = buildPromptWithContext(request.getContent(), context);

        // 4. 调用GLM-4模型
        String response = chatClient.call(prompt, history);

        // 5. 保存对话记忆
        memoryService.saveMessage(request.getConversationId(), request.getContent(), response);

        return new ChatResponse(response);
    }
}
```

### 2. 图片生成 (Image)

```java
@Service
public class ImageServiceImpl implements ImageService {

    private final ImageClient imageClient;  // Spring AI ImageClient

    public ImageResponse generateImage(ImageRequest request) {
        // 调用 Kolors 模型生成图片
        ImageResponse response = imageClient.call(
            new ImagePrompt(request.getPrompt(),
                SiliconFlowImageOptions.builder()
                    .model("Kwai-Kolors/Kolors")
                    .width(request.getWidth())
                    .height(request.getHeight())
                    .build()
            )
        );

        return response;
    }
}
```

### 3. 语音识别 (Voice)

```java
@Service
public class VoiceServiceImpl implements VoiceService {

    private final AudioTranscriptionClient transcriptionClient;

    public String transcribe(byte[] audioData) {
        // 调用 TeleSpeechASR 进行语音识别
        return transcriptionClient.transcribe(audioData);
    }
}
```

### 4. RAG 检索增强

```java
@Service
public class RagServiceImpl implements RagService {

    private final RedisVectorStore vectorStore;
    private final EmbeddingClient embeddingClient;

    public List<String> retrieve(String query) {
        // 1. 将查询转为向量
        float[] queryVector = embeddingClient.embed(query);

        // 2. 向量相似度搜索
        List<Document> results = vectorStore.similaritySearch(
            VectorSearchRequest.query(query)
                .withTopK(5)
                .withSimilarityThreshold(0.7)
        );

        // 3. 返回相关文档内容
        return results.stream()
            .map(Document::getContent)
            .collect(Collectors.toList());
    }

    public void indexDocument(String content) {
        // 文档向量化并存储
        Document doc = new Document(content);
        vectorStore.add(List.of(doc));
    }
}
```

### 5. 高德地图 MCP 集成

```java
@Component
public class AmapMcpClient {

    @Value("${amap.api-key}")
    private String apiKey;

    private final McpClient mcpClient;

    // 地理编码
    public String geocode(String address) {
        return mcpClient.callTool("amap_geocode", Map.of(
            "address", address,
            "key", apiKey
        ));
    }

    // 路径规划
    public String routePlanning(String origin, String destination) {
        return mcpClient.callTool("amap_direction", Map.of(
            "origin", origin,
            "destination", destination,
            "key", apiKey
        ));
    }

    // POI搜索
    public String searchPoi(String keywords, String location) {
        return mcpClient.callTool("amap_search", Map.of(
            "keywords", keywords,
            "location", location,
            "key", apiKey
        ));
    }
}
```

---

## API 接口设计

### RESTful API

| 方法 | 路径 | 描述 |
|------|------|------|
| **对话** |||
| POST | `/api/chat` | 发送消息对话 |
| GET | `/api/conversations` | 获取会话列表 |
| GET | `/api/conversations/{id}/messages` | 获取会话消息 |
| DELETE | `/api/conversations/{id}` | 删除会话 |
| **图片** |||
| POST | `/api/image/generate` | 生成图片 |
| GET | `/api/image/{id}` | 获取图片 |
| **语音** |||
| POST | `/api/voice/transcribe` | 语音转文字 |
| **地图** |||
| GET | `/api/map/geocode` | 地址转坐标 |
| GET | `/api/map/route` | 路径规划 |
| GET | `/api/map/poi` | POI搜索 |
| **知识库** |||
| POST | `/api/knowledge` | 添加知识文档 |
| GET | `/api/knowledge/search` | 搜索知识 |

---

## 配置文件

### application.yml

```yaml
spring:
  application:
    name: ai-assistant

  # 数据源配置
  datasource:
    url: jdbc:mysql://localhost:3306/ai_assistant?useUnicode=true&characterEncoding=utf-8&serverTimezone=Asia/Shanghai
    username: root
    password: ${DB_PASSWORD}
    driver-class-name: com.mysql.cj.jdbc.Driver

  jpa:
    hibernate:
      ddl-auto: update
    show-sql: false

  # Redis配置 (Redis Stack)
  data:
    redis:
      host: localhost
      port: 6379
      password: ${REDIS_PASSWORD:}

  # Spring AI 配置
  ai:
    openai:
      api-key: ${SILICONFLOW_API_KEY}
      base-url: https://api.siliconflow.cn/v1
      chat:
        options:
          model: THUDM/glm-4-9b-chat
          temperature: 0.7
      image:
        options:
          model: Kwai-Kolors/Kolors

  # 向量存储配置
    vectorstore:
      redis:
        uri: redis://localhost:6379
        index: knowledge_idx
        prefix: "doc:"

# 高德地图配置
amap:
  api-key: ${AMAP_API_KEY}
  base-url: https://restapi.amap.com/v3

# MCP配置
mcp:
  servers:
    amap:
      command: npx
      args:
        - "-y"
        - "@anthropic-ai/mcp-server-amap"

server:
  port: 8080
```

---

## 前端界面设计

### 功能模块

1. **聊天界面** - 对话窗口、历史记录、模型切换
2. **图片生成** - 提示词输入、图片展示、下载
3. **语音输入** - 录音按钮、实时转写
4. **地图服务** - 位置搜索、路线规划、POI展示

### 技术选型

```
前端技术栈:
├── Vue 3 + TypeScript
├── Element Plus (UI组件库)
├── Pinia (状态管理)
├── Axios (HTTP请求)
├── Socket.io-client (实时通信)
└── AMap JS API (地图组件)
```

---

## 依赖管理

### pom.xml 核心依赖

```xml
<dependencies>
    <!-- Spring Boot -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>

    <!-- Spring AI -->
    <dependency>
        <groupId>org.springframework.ai</groupId>
        <artifactId>spring-ai-openai-spring-boot-starter</artifactId>
        <version>1.0.0-M4</version>
    </dependency>

    <!-- Spring Data JPA -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>

    <!-- MySQL -->
    <dependency>
        <groupId>com.mysql</groupId>
        <artifactId>mysql-connector-j</artifactId>
    </dependency>

    <!-- Redis -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-redis</artifactId>
    </dependency>

    <!-- Redis Stack Vector Store -->
    <dependency>
        <groupId>org.springframework.ai</groupId>
        <artifactId>spring-ai-redis-store</artifactId>
        <version>1.0.0-M4</version>
    </dependency>

    <!-- MCP Client -->
    <dependency>
        <groupId>io.modelcontextprotocol</groupId>
        <artifactId>mcp-client</artifactId>
        <version>0.5.0</version>
    </dependency>

    <!-- Lombok -->
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <optional>true</optional>
    </dependency>
</dependencies>
```

---

## 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Nginx (反向代理)                        │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
┌───────────────────┐                   ┌───────────────────┐
│   前端静态资源     │                   │   后端API服务      │
│   (Vue Build)     │                   │   Spring Boot     │
└───────────────────┘                   └───────────────────┘
                                                │
                        ┌───────────────────────┼───────────────────────┐
                        ▼                       ▼                       ▼
                ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
                │    MySQL      │       │ Redis Stack   │       │ 硅基流动 API   │
                │   (数据持久化) │       │  (向量存储)    │       │  (AI模型)     │
                └───────────────┘       └───────────────┘       └───────────────┘
```

---

## 开发计划

### Phase 1: 基础框架搭建
- [ ] 创建 Spring Boot 项目
- [ ] 配置 Maven 依赖
- [ ] 连接 MySQL 数据库
- [ ] 创建基础实体类和 Repository

### Phase 2: AI 功能集成
- [ ] 集成 Spring AI + 硅基流动 API
- [ ] 实现对话功能 (GLM-4-9b)
- [ ] 实现图片生成 (Kolors)
- [ ] 实现语音识别 (TeleSpeechASR)

### Phase 3: 记忆与RAG
- [ ] 配置 Redis Stack
- [ ] 实现对话记忆存储
- [ ] 实现向量嵌入
- [ ] 实现 RAG 检索增强

### Phase 4: 地图服务
- [ ] 配置 MCP Client
- [ ] 集成高德地图 API
- [ ] 实现地理编码/路径规划

### Phase 5: 前端开发
- [ ] 搭建 Vue 项目
- [ ] 实现聊天界面
- [ ] 实现图片生成界面
- [ ] 实现语音输入
- [ ] 集成地图组件

### Phase 6: 测试与优化
- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能优化
- [ ] 部署上线

---

## 环境变量

```bash
# 必需的环境变量
export SILICONFLOW_API_KEY="your_siliconflow_api_key"
export AMAP_API_KEY="your_amap_api_key"
export DB_PASSWORD="your_mysql_password"
export REDIS_PASSWORD="your_redis_password"  # 可选
```

---

## 参考资源

- [Spring AI 官方文档](https://docs.spring.io/spring-ai/reference/)
- [硅基流动 API 文档](https://docs.siliconflow.cn/)
- [高德地图 API 文档](https://lbs.amap.com/api/)
- [Redis Stack 文档](https://redis.io/docs/stack/)
- [MCP 协议规范](https://modelcontextprotocol.io/)
