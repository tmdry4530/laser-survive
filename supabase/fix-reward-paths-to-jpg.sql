-- Update reward metadata to match uploaded .jpg storage objects.
update public.rewards
set storage_path = replace(storage_path, '.png', '.jpg')
where storage_path like '%.png';

select id, mode, storage_path, active
from public.rewards
order by mode, storage_path;
