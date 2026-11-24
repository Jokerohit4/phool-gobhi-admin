import { ActionForm } from '@/components/ui/ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { deleteUserDataAction } from './actions';

export interface DeletionCategory {
  id: string;
  label: string;
}

export function UserDataDeletion({ userId, name, categories }: {
  userId: number;
  name: string | null;
  categories: DeletionCategory[];
}) {
  const account = name ? `${name} (user #${userId})` : `user #${userId}`;

  return (
    <details>
      <summary className="cursor-pointer whitespace-nowrap font-medium text-red-700 dark:text-red-400">
        Delete data
      </summary>
      <div className="mt-3 flex min-w-56 flex-col gap-3">
        <ActionForm
          action={deleteUserDataAction}
          confirmMessage={`Permanently delete the selected data category for ${account}?`}
          className="flex flex-col items-start gap-2"
        >
          <input type="hidden" name="id" value={userId} />
          <label className="text-sm font-medium" htmlFor={`delete-category-${userId}`}>Data category</label>
          <select
            id={`delete-category-${userId}`}
            name="scope"
            required
            defaultValue=""
            className="w-full rounded border px-2 py-1 text-sm dark:bg-gray-900"
          >
            <option value="" disabled>Select category</option>
            {categories.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>
          <SubmitButton variant="secondary" pendingText="Deleting…">Delete selected</SubmitButton>
        </ActionForm>
        <ActionForm
          action={deleteUserDataAction}
          confirmMessage={`Permanently delete ${account} and their erasable data? Booking and financial records are retained.`}
          className="flex flex-col items-start gap-2 border-t pt-3"
        >
          <input type="hidden" name="id" value={userId} />
          <input type="hidden" name="scope" value="all" />
          <p className="max-w-56 text-xs text-gray-600 dark:text-gray-400">
            Deletes the customer account. Booking and financial records are retained.
          </p>
          <SubmitButton variant="danger" pendingText="Deleting…">Delete all</SubmitButton>
        </ActionForm>
      </div>
    </details>
  );
}
