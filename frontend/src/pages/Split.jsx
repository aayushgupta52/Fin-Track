import { useEffect, useState } from 'react';
import { splitApi } from '../services/api.js';
import { formatINR, formatDate } from '../utils/format.js';
import Field, { inputClass } from '../components/Field.jsx';

function Card({ title, action, children }) {
  return (
    <section className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// ── Groups overview ─────────────────────────────────────────────────────────
function GroupsList({ groups, onOpen, onCreate, onDelete }) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('👥');
  const [members, setMembers] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const memberNames = members
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);
      await onCreate({ name, emoji: emoji || '👥', members: memberNames });
      setName('');
      setEmoji('👥');
      setMembers('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not create group');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card title="Your groups">
          {groups.length === 0 ? (
            <p className="py-6 text-center text-slate-400">
              No groups yet. Create one for your trip or flat.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {groups.map((g) => {
                const settled = Math.abs(g.yourBalance) < 0.01;
                return (
                  <button
                    key={g.id}
                    onClick={() => onOpen(g.id)}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-left transition hover:border-brand hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{g.emoji}</span>
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{g.name}</p>
                          <p className="text-xs text-slate-400">
                            {g.memberCount} people · {g.expenseCount} expenses
                          </p>
                        </div>
                      </div>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(g.id);
                        }}
                        className="text-xs text-slate-400 hover:text-red-600"
                        title="Delete group"
                      >
                        ✕
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      Total spent {formatINR(g.totalSpent)}
                    </p>
                    <p
                      className={`text-sm font-semibold ${
                        settled
                          ? 'text-slate-500'
                          : g.yourBalance > 0
                            ? 'text-emerald-600'
                            : 'text-red-600'
                      }`}
                    >
                      {settled
                        ? 'All settled up'
                        : g.yourBalance > 0
                          ? `You are owed ${formatINR(g.yourBalance)}`
                          : `You owe ${formatINR(-g.yourBalance)}`}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card title="New group">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Group name">
            <input
              required
              className={inputClass}
              placeholder="e.g. Goa Trip, Flat 302"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Emoji">
            <input
              className={inputClass}
              maxLength={4}
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
            />
          </Field>
          <Field label="Members (comma separated)">
            <input
              className={inputClass}
              placeholder="Bob, Cara, Dev"
              value={members}
              onChange={(e) => setMembers(e.target.value)}
            />
          </Field>
          <p className="text-xs text-slate-400">You are added automatically.</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? 'Creating…' : 'Create group'}
          </button>
        </form>
      </Card>
    </div>
  );
}

// ── Add-expense form ────────────────────────────────────────────────────────
function ExpenseForm({ members, onAdd }) {
  const you = members.find((m) => m.isYou) || members[0];
  const [form, setForm] = useState({ description: '', amount: '', paidById: you?.id || '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const perHead =
    form.amount && members.length ? Number(form.amount) / members.length : 0;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onAdd({
        description: form.description,
        amount: Number(form.amount),
        paidById: form.paidById,
      });
      setForm({ description: '', amount: '', paidById: you?.id || '' });
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not add expense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Description">
        <input
          required
          className={inputClass}
          placeholder="e.g. Dinner, Cab, Groceries"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </Field>
      <Field label="Amount (₹)">
        <input
          type="number"
          min="1"
          step="0.01"
          required
          className={inputClass}
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
      </Field>
      <Field label="Paid by">
        <select
          className={inputClass}
          value={form.paidById}
          onChange={(e) => setForm({ ...form, paidById: e.target.value })}
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>
      <p className="text-xs text-slate-400">
        Split equally · {formatINR(perHead)} per person ({members.length})
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {saving ? 'Adding…' : 'Add expense'}
      </button>
    </form>
  );
}

// ── Group detail ────────────────────────────────────────────────────────────
function GroupDetail({ group, onBack, actions }) {
  const [memberName, setMemberName] = useState('');
  const settled = Math.abs(group.yourBalance) < 0.01;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button onClick={onBack} className="mb-1 text-sm text-brand hover:underline">
            ← All groups
          </button>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {group.emoji} {group.name}
          </h1>
          <p className="text-sm text-slate-500">
            {group.members.length} people · total spent {formatINR(group.totalSpent)}
          </p>
        </div>
        <div
          className={`rounded-xl px-4 py-2 text-right ${
            settled
              ? 'bg-slate-100 dark:bg-slate-700'
              : group.yourBalance > 0
                ? 'bg-emerald-50 dark:bg-emerald-900/30'
                : 'bg-red-50 dark:bg-red-900/30'
          }`}
        >
          <p className="text-xs text-slate-500">Your balance</p>
          <p
            className={`text-lg font-bold ${
              settled ? 'text-slate-600' : group.yourBalance > 0 ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {settled
              ? 'Settled'
              : group.yourBalance > 0
                ? `+${formatINR(group.yourBalance)}`
                : `-${formatINR(-group.yourBalance)}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Settle up plan */}
          <Card title="Settle up">
            {group.settleUp.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">Everyone is squared up 🎉</p>
            ) : (
              <ul className="space-y-2">
                {group.settleUp.map((t, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"
                  >
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      <span className="font-medium">{t.fromName}</span> pays{' '}
                      <span className="font-medium">{t.toName}</span>{' '}
                      <span className="font-semibold text-brand">{formatINR(t.amount)}</span>
                    </span>
                    <button
                      onClick={() =>
                        actions.settle({ fromId: t.fromId, toId: t.toId, amount: t.amount })
                      }
                      className="rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                    >
                      Mark paid
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Expenses */}
          <Card title="Expenses">
            {group.expenses.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">No expenses yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {group.expenses.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {e.description}
                      </p>
                      <p className="text-xs text-slate-400">
                        {e.paidByName} paid · {formatDate(e.date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {formatINR(e.amount)}
                      </span>
                      <button
                        onClick={() => actions.removeExpense(e.id)}
                        className="text-xs text-slate-400 hover:text-red-600"
                        title="Delete expense"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Settlement history */}
          {group.settlements.length > 0 && (
            <Card title="Payments">
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {group.settlements.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2.5">
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {s.fromName} → {s.toName}{' '}
                      <span className="text-xs text-slate-400">· {formatDate(s.date)}</span>
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {formatINR(s.amount)}
                      </span>
                      <button
                        onClick={() => actions.removeSettlement(s.id)}
                        className="text-xs text-slate-400 hover:text-red-600"
                        title="Delete payment"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card title="Add expense">
            <ExpenseForm members={group.members} onAdd={actions.addExpense} />
          </Card>

          <Card title="Balances">
            <ul className="space-y-1.5">
              {group.balances.map((b) => {
                const zero = Math.abs(b.net) < 0.01;
                return (
                  <li key={b.memberId} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300">
                      {b.name}
                      {b.isYou && <span className="text-xs text-slate-400"> (you)</span>}
                    </span>
                    <span
                      className={
                        zero ? 'text-slate-400' : b.net > 0 ? 'text-emerald-600' : 'text-red-600'
                      }
                    >
                      {zero
                        ? '—'
                        : b.net > 0
                          ? `gets ${formatINR(b.net)}`
                          : `owes ${formatINR(-b.net)}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title="Members">
            <ul className="mb-3 space-y-1.5">
              {group.members.map((m) => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-300">
                    {m.name}
                    {m.isYou && <span className="text-xs text-slate-400"> (you)</span>}
                  </span>
                  {!m.isYou && (
                    <button
                      onClick={() => actions.removeMember(m.id)}
                      className="text-xs text-slate-400 hover:text-red-600"
                    >
                      remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!memberName.trim()) return;
                actions.addMember({ name: memberName.trim() });
                setMemberName('');
              }}
              className="flex gap-2"
            >
              <input
                className={inputClass}
                placeholder="Add member"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
              />
              <button
                type="submit"
                className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50"
              >
                Add
              </button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function Split() {
  const [groups, setGroups] = useState([]);
  const [active, setActive] = useState(null); // full group detail
  const [loading, setLoading] = useState(true);

  const refreshList = async () => {
    const data = await splitApi.groups();
    setGroups(data.groups);
    setLoading(false);
  };

  useEffect(() => {
    refreshList().catch(() => setLoading(false));
  }, []);

  const open = async (id) => {
    const data = await splitApi.group(id);
    setActive(data.group);
  };

  const createGroup = async (body) => {
    const data = await splitApi.createGroup(body);
    await refreshList();
    setActive(data.group);
  };

  const deleteGroup = async (id) => {
    await splitApi.removeGroup(id);
    refreshList();
  };

  // Detail actions all return the refreshed group, so we just swap it in.
  const actions = {
    addExpense: async (body) => setActive((await splitApi.addExpense(active.id, body)).group),
    removeExpense: async (eid) => setActive((await splitApi.removeExpense(active.id, eid)).group),
    settle: async (body) => setActive((await splitApi.addSettlement(active.id, body)).group),
    removeSettlement: async (sid) =>
      setActive((await splitApi.removeSettlement(active.id, sid)).group),
    addMember: async (body) => setActive((await splitApi.addMember(active.id, body)).group),
    removeMember: async (mid) => {
      try {
        setActive((await splitApi.removeMember(active.id, mid)).group);
      } catch (err) {
        alert(err?.response?.data?.message || 'Could not remove member');
      }
    },
  };

  if (active) {
    return (
      <GroupDetail
        group={active}
        onBack={() => {
          setActive(null);
          refreshList();
        }}
        actions={actions}
      />
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Split Expenses</h1>
        <p className="text-sm text-slate-500">
          Share bills with roommates and trip friends — we do the settle-up math.
        </p>
      </div>
      {loading ? (
        <p className="py-6 text-center text-slate-400">Loading…</p>
      ) : (
        <GroupsList groups={groups} onOpen={open} onCreate={createGroup} onDelete={deleteGroup} />
      )}
    </div>
  );
}
