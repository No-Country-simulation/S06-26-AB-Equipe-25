# DATABASE.md
## Schema do Banco de Dados — App BiT B2B
**Equipe:** S06-26-AB-Equipe 25  
**Responsável:** Mike Dados do Murilo (Database Administrator)  
**Versão:** 1.0  
**Data:** junho/2026

---

## Visão Geral

Este documento descreve a arquitetura do banco de dados da plataforma B2B do App BiT — uma solução que conecta empresas com talentos de grupos sub-representados, usando dados de geolocalização para identificar concentração de talentos por região e gerar relatórios de diversidade para metas ESG.

O banco é composto por **5 tabelas principais**, organizadas em torno do fluxo central da aplicação:

> Empresa se cadastra → publica vaga → sistema retorna candidatos ranqueados → empresa visualiza dashboard ESG

---

## Tabelas

### 1. `empresas`

Armazena o cadastro das empresas que utilizam a plataforma. Cada empresa possui um perfil com suas metas de diversidade e região de atuação.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | INT (PK) | Sim | Identificador único da empresa |
| `nome` | VARCHAR(255) | Sim | Razão social da empresa |
| `cnpj` | VARCHAR(18) | Sim | CNPJ no formato XX.XXX.XXX/XXXX-XX (único) |
| `setor` | VARCHAR(100) | Sim | Setor de atuação (ex: Tecnologia, Saúde, Educação) |
| `regiao` | VARCHAR(100) | Sim | Zona geográfica de atuação — referência aos clusters do dataset Visent |
| `meta_diversidade` | FLOAT | Sim | Percentual mínimo de diversidade que a empresa deseja atingir (0.0 a 1.0) |
| `created_at` | TIMESTAMP | Sim | Data e hora do cadastro |

**Observações:**
- `cnpj` deve ser único na base
- `regiao` deve referenciar um dos 27 clusters geográficos do dataset Visent (ex: `CBD_BEIRAMAR`, `TRINDADE`, `SAO_JOSE_CENTRO`)
- `meta_diversidade` será usada para calcular o score ESG no dashboard

---

### 2. `vagas`

Armazena as vagas publicadas pelas empresas. Cada vaga pertence a uma empresa e define os requisitos técnicos e as metas de diversidade esperadas para o processo seletivo.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | INT (PK) | Sim | Identificador único da vaga |
| `empresa_id` | INT (FK) | Sim | Referência à empresa que publicou a vaga |
| `titulo` | VARCHAR(255) | Sim | Título da vaga (ex: Desenvolvedora Backend Pleno) |
| `descricao` | TEXT | Não | Descrição completa da vaga |
| `skills_requeridas` | TEXT | Sim | Lista de habilidades exigidas separadas por vírgula (ex: Python, SQL, AWS) |
| `nivel` | VARCHAR(20) | Sim | Nível de senioridade: `junior`, `pleno` ou `senior` |
| `regiao` | VARCHAR(100) | Sim | Zona geográfica preferencial para o candidato |
| `diversidade_minima` | FLOAT | Sim | Percentual mínimo de candidatos diversos esperado na shortlist (0.0 a 1.0) |
| `data_publicacao` | DATE | Sim | Data de abertura da vaga |
| `data_prazo` | DATE | Sim | Data limite para candidaturas |
| `status` | VARCHAR(20) | Sim | Estado atual da vaga: `aberta` ou `fechada` |

**Observações:**
- `empresa_id` é chave estrangeira referenciando `empresas.id`
- `nivel` aceita apenas os valores: `junior`, `pleno`, `senior`
- `status` aceita apenas os valores: `aberta`, `fechada`
- `diversidade_minima` é o parâmetro que o endpoint `/match` usa para filtrar a shortlist

---

### 3. `candidatos`

Armazena o perfil dos candidatos cadastrados na plataforma. Os campos demográficos (`regiao` e `income_cluster`) são inspirados na estrutura do arquivo `assinantes.csv` do dataset Visent, permitindo cruzamento futuro com os dados de concentração geográfica.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | INT (PK) | Sim | Identificador único do candidato |
| `nome` | VARCHAR(255) | Sim | Nome completo |
| `idade` | INT | Sim | Idade em anos |
| `genero` | VARCHAR(50) | Sim | Gênero autodeclarado |
| `regiao` | VARCHAR(100) | Sim | Zona geográfica de residência — referência ao `home_cluster` do dataset Visent |
| `income_cluster` | CHAR(1) | Sim | Faixa de renda: `A` (alta), `B` (média-alta), `C` (média), `D` (baixa) |
| `skills` | TEXT | Sim | Lista de habilidades separadas por vírgula (ex: React, Node.js, PostgreSQL) |
| `nivel` | VARCHAR(20) | Sim | Nível de senioridade: `junior`, `pleno` ou `senior` |
| `experiencia_anos` | INT | Sim | Anos de experiência profissional |
| `grupo_subrepresentado` | BOOLEAN | Sim | Flag que indica se o candidato pertence a grupo sub-representado — este é o **badge de diversidade** da plataforma |
| `created_at` | TIMESTAMP | Sim | Data e hora do cadastro |

**Observações:**
- `grupo_subrepresentado` é o campo mais crítico desta tabela — é ele que alimenta o score ESG e o badge de diversidade exibido na shortlist
- `regiao` segue os mesmos valores de cluster do dataset Visent para permitir integração com o `mapa_talentos`
- `income_cluster` segue o mesmo padrão do campo homônimo em `assinantes.csv`
- Para o MVP, `grupo_subrepresentado` é um campo declarativo — o candidato informa no cadastro

---

### 4. `matches`

Tabela central do endpoint `/match`. Armazena o resultado do cruzamento entre uma vaga e um candidato, incluindo o score de compatibilidade e o badge de diversidade. É gerada pelo agente de IA quando uma empresa solicita uma shortlist.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | INT (PK) | Sim | Identificador único do match |
| `vaga_id` | INT (FK) | Sim | Referência à vaga avaliada |
| `candidato_id` | INT (FK) | Sim | Referência ao candidato avaliado |
| `score_match` | FLOAT | Sim | Score de compatibilidade entre candidato e vaga (0.0 a 100.0) |
| `badge_diversidade` | BOOLEAN | Sim | Indica se o candidato possui badge de diversidade neste match |
| `status` | VARCHAR(20) | Sim | Estado do candidato no processo: `shortlisted`, `rejeitado` ou `contratado` |
| `created_at` | TIMESTAMP | Sim | Data e hora em que o match foi gerado |

**Observações:**
- `vaga_id` é chave estrangeira referenciando `vagas.id`
- `candidato_id` é chave estrangeira referenciando `candidatos.id`
- `score_match` é calculado pelo agente com base na compatibilidade de `skills`, `nivel`, `regiao` e `grupo_subrepresentado`
- `status` aceita apenas os valores: `shortlisted`, `rejeitado`, `contratado`
- Um mesmo candidato pode aparecer em múltiplos matches para vagas diferentes

---

### 5. `mapa_talentos`

Tabela alimentada pelo dataset da Visent (arquivo `tensor_concentracao.csv` + `assinantes.csv`). Representa a concentração de pessoas por zona geográfica e é usada para gerar o mapa interativo que a empresa visualiza antes de publicar uma vaga.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | INT (PK) | Sim | Identificador único do registro |
| `cluster` | VARCHAR(100) | Sim | Nome da zona geográfica (ex: `CBD_BEIRAMAR`, `TRINDADE`) — um dos 27 clusters do dataset Visent |
| `municipio` | VARCHAR(100) | Sim | Município do cluster (ex: Florianópolis, São José) |
| `lat` | FLOAT | Sim | Latitude do centroide do cluster |
| `lon` | FLOAT | Sim | Longitude do centroide do cluster |
| `total_pessoas` | INT | Sim | Total de pessoas estimadas nessa zona |
| `income_predominante` | CHAR(1) | Sim | Faixa de renda predominante na zona: `A`, `B`, `C` ou `D` |
| `age_group_predominante` | VARCHAR(10) | Sim | Faixa etária predominante (ex: `25-34`, `35-44`) |
| `periodo_pico` | VARCHAR(20) | Sim | Período do dia com maior concentração: `MANHA`, `TARDE` ou `NOITE` |
| `updated_at` | TIMESTAMP | Sim | Data da última atualização dos dados |

**Observações:**
- Esta tabela não é preenchida pelos usuários da plataforma — é populada a partir do dataset da Visent
- Cada `cluster` corresponde a uma das 27 zonas geográficas calibradas por densidade populacional IBGE 2022
- É consumida pelo endpoint `GET /insights` para gerar o mapa de talentos por região
- Deve ser atualizada periodicamente conforme novos dados do dataset forem processados

---

## Relacionamentos

```
empresas (1) ──── (N) vagas
vagas    (1) ──── (N) matches
candidatos (1) ── (N) matches
mapa_talentos ─── informa vagas (relação de consulta, não de chave estrangeira)
```

---

## Endpoints que consomem este banco

| Endpoint | Tabelas envolvidas | Descrição |
|---|---|---|
| `POST /match` | `vagas`, `candidatos`, `matches` | Gera shortlist de candidatos para uma vaga |
| `GET /insights` | `mapa_talentos` | Retorna concentração de talentos por região |
| `GET /vagas` | `vagas`, `empresas` | Lista vagas de uma empresa |
| `GET /dashboard` | `matches`, `vagas`, `candidatos` | Retorna métricas de diversidade para o dashboard ESG |

---

## Dados mockados para desenvolvimento

Para o MVP, o backend pode popular as tabelas com dados fictícios antes da integração real com o dataset Visent. Sugestão de volume mínimo para testes:

- `empresas`: 3 registros
- `vagas`: 5 registros (2 abertas, 1 fechada)
- `candidatos`: 20 registros (com variação de `grupo_subrepresentado`, `nivel` e `regiao`)
- `matches`: gerados automaticamente pelo endpoint `/match`
- `mapa_talentos`: 27 registros (um por cluster do dataset Visent)

---

## Fonte dos dados geográficos

Os valores de `regiao` e `cluster` utilizados neste schema seguem a nomenclatura oficial do dataset **CDRView — Região Metropolitana de Florianópolis** fornecido pela Visent, disponível em:

> `github.com/wongola-bit/appbit` — arquivo `assinantes.csv` e `tensor_concentracao.csv`

Os 27 clusters disponíveis são: `CBD_BEIRAMAR`, `CENTRO_HISTORICO`, `TRINDADE`, `UFSC`, `COQUEIROS`, `ESTREITO_CAPOEIRAS`, `AEROPORTO_HLZ`, `CAMPECHE`, `LAGOA_CONCEICAO`, `JURERE`, `CANASVIEIRAS`, `INGLESES`, `NORTE_ILHA`, `RESIDENCIAL_NORTE`, `SC401_CORREDOR`, `SAO_JOSE_CENTRO`, `SAO_JOSE_BARREIROS`, `SAO_JOSE_KOBRASOL`, `SAO_JOSE_ROCADO`, `PALHOCA_CENTRO`, `PALHOCA_PEDRA_BRANCA`, `PALHOCA_BR101_SUL`, `BIGUACU_BR101_NORTE`, `VIA_EXPRESSA_CORREDOR`, `SANTO_AMARO`, `GOV_CELSO_RAMOS`, `ANTONIO_CARLOS`.

---

*Documento gerado na Semana 0 do Hackathon App BiT — junho/2026*
