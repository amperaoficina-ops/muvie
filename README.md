# MUVI-E

Landing page e painel de operação para a loja de scooters elétricas de São José e Palhoça. O projeto segue a estrutura técnica da Ampera com Next.js App Router, React, TypeScript, Tailwind CSS, MongoDB e npm. O manifesto e o lockfile preservam as mesmas dependências e versões da referência.

## Rodar no computador

Use Node.js 22 e MongoDB em localhost. Se o MongoDB ainda não estiver instalado e você usa Docker, pode iniciar uma instância local com volume persistente:

```bash
docker run -d --name muvie-mongo -p 127.0.0.1:27017:27017 -v muvie-mongo-data:/data/db mongo:7.0
```

Na raiz do projeto, instale as dependências e copie o exemplo:

```bash
npm ci
cp .env.example .env.local
```

No PowerShell, use `Copy-Item .env.example .env.local`. Preencha `MUVIE_ADMIN_EMAIL` e `MUVIE_ADMIN_PASSWORD` no arquivo `.env.local` com um e-mail e uma senha de pelo menos 12 caracteres. Depois:

```bash
npm run db:seed-admin
npm run dev
```

- [Landing page](http://127.0.0.1:3000/)
- [Painel](http://127.0.0.1:3000/admin)

O servidor escuta em `127.0.0.1`. O app aceita somente MongoDB local e um nome de banco com prefixo `muvie_`. A configuração inicial usa `muvie_local`.

## Primeiro uso

1. Cadastre um produto em **Produtos** com SKU e preço. Marque **Exibir este produto na landing page** quando quiser colocá-lo no catálogo.
2. Registre a compra em **Compras** com fornecedor, data, quantidade, custo e unidade. A compra já lança a entrada no estoque. Use **Estoque** para ajustes e transferências.
3. Cadastre ou atualize a ficha em **Clientes / CRM**, com dados pessoais, endereço e acompanhamento. Vincule o cliente na compra ou venda para ver o registro na ficha.
4. Registre a venda com unidade, produto, quantidade, forma de pagamento e desconto opcional. O registro aceita um SKU por venda. A operação dá baixa no estoque da loja selecionada e marca o contato vinculado como ganho.
5. Use **Cancelar** no histórico para devolver o saldo à unidade original e retirar a venda do total ativo. Pagamento e cancelamento são registros internos, sem cobrança, devolução bancária ou emissão fiscal automática.
6. Anexe PDF ou XML (até 8 MB por arquivo) no histórico de **Compras** ou **Vendas**, depois de salvar o registro. A ficha do cliente reúne os documentos das operações vinculadas e aceita notas avulsas. Os arquivos são armazenados no MongoDB local e exigem sessão de administrador para download.

## Atualizar uma instalação existente

Pare a Muvie, preserve o seu `.env.local` e mantenha o mesmo banco MongoDB. Atualize os arquivos do projeto e rode `npm ci` e `npm run dev`. Os cadastros existentes serão carregados com os novos campos disponíveis.

## Demonstração em banco separado (PowerShell)

Com o MongoDB local ativo, copie o exemplo e escolha uma senha de pelo menos 12 caracteres:

```powershell
Copy-Item .env.demo.example .env.demo.local
notepad .env.demo.local
npm.cmd run db:demo
npm.cmd run dev:demo
```

Acesse `http://127.0.0.1:3001/admin` com o e-mail e a senha de demonstração. A carga só aceita o banco `muvie_demo` e preserva os registros existentes em novas execuções. O exemplo inclui Bravus, estoque nas duas lojas, compra, transferência, vendas, cliente, notas XML fictícias, taxas e gráficos. Comece em **Simular venda** e depois confira **Vendas**, **Estoque** e **Clientes / CRM**.

As taxas são porcentagens totais de cada condição. O simulador mostra os valores por parcela, a taxa e o líquido da loja, sem registrar pagamento ou alterar estoque. O administrador pode criar e desativar contas de atendimento. O log registra alterações realizadas no painel (até 2.000 entradas). Relatos autorizados podem ser publicados em **Relatos da landing**.

## Operação e financeiro por loja

- Em **Administração das lojas**, selecione São José ou Palhoça. Cadastre equipe, salário, comissão, custos fixos e estrutura. Use **Lançar fixos e salários** para gerar a competência do mês. Repetir esse comando preserva os valores que já foram lançados.
- Em **Compras**, informe se o lote já foi quitado, tem vencimento a pagar ou é consignado. Uma compra quitada registra saída na data informada. Para uma compra a pagar, registre a baixa no Financeiro na data efetiva. O lote acompanha as transferências e as vendas usam primeiro os lotes mais antigos com saldo. A venda consignada gera um repasse a pagar, cujo vencimento pode ser informado no Financeiro.
- Em **Vendas**, informe a unidade, o vendedor e se o pagamento já entrou ou ainda está a receber. A comissão é calculada sobre o valor após desconto e registrada no momento da venda. Use o Financeiro para registrar baixas parciais, vencimentos e estornos.
- **Visão Geral** abre no mês atual e aceita outro período e unidade. O **DRE gerencial** usa a competência dos lançamentos e o **caixa** usa as datas das baixas e estornos. A classificação “Somente caixa” permite controlar entradas e saídas que ficam fora do resultado gerencial.
- Compras e vendas antigas permanecem no histórico. A atualização não presume que foram pagas ou recebidas. Saldos sem lote usam o custo de referência quando informado; o DRE sinaliza vendas sem custo completo. O cadastro da estrutura é patrimonial e não gera, sozinho, uma despesa ou saída de caixa.
- Rode novamente `npm.cmd run db:demo` para acrescentar exemplos financeiros às duas unidades do banco de demonstração já criado.

### Cargos e permissões

Em **Usuários**, selecione Administrador, Vendedor, Financeiro, Estoque e compras ou Atendimento. Use o padrão do cargo ou escolha **Personalizar módulos** para marcar exatamente quais áreas a conta pode acessar. Um módulo liberado inclui as operações daquela área. O acesso à gestão de usuários fica reservado ao cargo Administrador, e a conta administrativa inicial mantém acesso integral como recuperação. As permissões valem para navegação, ações do servidor e downloads restritos. São permissões por módulo, sem restrição por unidade.

Em **Administração das lojas**, o filtro **Todas** mostra os totais e os cartões das duas unidades. Selecione a unidade para editar seus cadastros ou lançar a competência.

O catálogo inicial vem vazio. O contato da landing usa o Instagram informado para as duas unidades. Os endereços e horários podem ser incluídos quando confirmados.

## Verificar

```bash
npm run check
```

Nesta base local, o estado do ERP é gravado em um documento MongoDB com controle de revisão. Isso permite manter estoque, venda e CRM consistentes em uma única gravação, inclusive em MongoDB standalone. Para crescer além de um protótipo local, será necessário separar o volume operacional em coleções próprias e definir permissões por usuário e unidade.
